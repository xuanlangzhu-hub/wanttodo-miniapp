using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WantTodo.Api.Data;
using WantTodo.Api.DTOs;
using WantTodo.Api.Models;

namespace WantTodo.Api.Controllers;

[ApiController]
[Route("api/v1/cards")]
[Authorize]
public class CardsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<CardsController> _logger;

    public CardsController(AppDbContext db, IConfiguration config, IHttpClientFactory http,
        ILogger<CardsController> logger)
    {
        _db = db;
        _config = config;
        _http = http;
        _logger = logger;
    }

    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    private static readonly HashSet<string> ValidStatuses = new() { "todo", "done", "archived" };

    private int MaxCardsPerUser => Math.Max(1, _config.GetValue("Limits:MaxCardsPerUser", 100));
    private int MaxOrganizePerCard => Math.Max(1, _config.GetValue("Limits:MaxOrganizePerCard", 2));
    private int MaxDailyOrganizePerUser => Math.Max(1, _config.GetValue("Limits:MaxDailyOrganizePerUser", 10));

    // ═══════════════════════════════════════════
    // 4.1  GET /cards  卡片列表
    // ═══════════════════════════════════════════
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetCards(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string status = "all",
        [FromQuery] string keyword = "",
        [FromQuery] string tag = "",
        [FromQuery] string sort = "updatedAt",
        [FromQuery] string order = "desc")
    {
        if (pageSize > 100) pageSize = 100;
        var query = _db.Cards.Where(c => c.UserId == UserId && c.DeletedAt == null);

        // 状态筛选
        query = status switch
        {
            "todo" => query.Where(c => c.Status == "todo"),
            "done" => query.Where(c => c.Status == "done"),
            "archived" => query.Where(c => c.Status == "archived"),
            _ => query
        };

        var cards = await query.ToListAsync();

        // 关键词搜索（标题/摘要/原文/标签）
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            cards = cards.Where(c =>
                TextContains(c.Title, keyword) ||
                TextContains(c.Summary, keyword) ||
                TextContains(c.SourceText, keyword) ||
                c.GetTags().Any(t => TextContains(t, keyword))).ToList();
        }

        // 按标签筛选。TagsJson 中中文可能被 JSON 转义，必须反序列化后匹配。
        if (!string.IsNullOrWhiteSpace(tag))
        {
            cards = cards.Where(c =>
                c.GetTags().Any(t => string.Equals(t, tag, StringComparison.OrdinalIgnoreCase))).ToList();
        }

        cards = (sort, order) switch
        {
            ("createdAt", "asc") => cards.OrderBy(c => c.CreatedAt).ToList(),
            ("createdAt", "desc") => cards.OrderByDescending(c => c.CreatedAt).ToList(),
            ("updatedAt", "asc") => cards.OrderBy(c => c.UpdatedAt).ToList(),
            _ => cards.OrderByDescending(c => c.UpdatedAt).ToList()
        };

        var total = cards.Count;
        var pageCards = cards.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        var list = pageCards.Select(MapToResponse).ToList();

        return Ok(ApiResponse<object>.Ok(new { list, total, page, pageSize }));
    }

    // ═══════════════════════════════════════════
    // 4.2  GET /cards/{id}  卡片详情
    // ═══════════════════════════════════════════
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetCard(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId && c.DeletedAt == null);
        if (card == null)
            return NotFound(ApiResponse<object>.NotFound("卡片不存在"));

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ═══════════════════════════════════════════
    // GET /cards/quota  当前用户的终身卡片与每日 AI 额度
    // ═══════════════════════════════════════════
    [HttpGet("quota")]
    public async Task<ActionResult<ApiResponse<object>>> GetQuota()
    {
        var user = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == UserId);
        if (user == null)
            return Unauthorized(ApiResponse<object>.Unauthorized());

        var clock = GetQuotaClock();
        var dailyCount = await _db.DailyAiUsages.AsNoTracking()
            .Where(x => x.UserId == UserId && x.UsageDate == clock.DateKey)
            .Select(x => x.Count)
            .FirstOrDefaultAsync();

        return Ok(ApiResponse<object>.Ok(BuildQuotaResponse(user.TotalCardsCreated, dailyCount, clock.ResetAt)));
    }

    // ═══════════════════════════════════════════
    // 4.3  POST /cards  创建卡片
    // ═══════════════════════════════════════════
    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> CreateCard(CreateCardDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(ApiResponse<object>.BadRequest("title 不能为空"));

        await using var transaction = await _db.Database.BeginTransactionAsync();
        var reserved = await _db.Users
            .Where(u => u.Id == UserId && u.TotalCardsCreated < MaxCardsPerUser)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(u => u.TotalCardsCreated, u => u.TotalCardsCreated + 1));

        if (reserved == 0)
        {
            await transaction.RollbackAsync();
            return StatusCode(StatusCodes.Status409Conflict,
                ApiResponse<object>.Fail(409, $"累计创建卡片已达 {MaxCardsPerUser} 张上限"));
        }

        var srcUrl = dto.SourceUrl ?? "";
        var card = new KnowledgeCard
        {
            Title = dto.Title,
            SourceText = dto.SourceText ?? "",
            Summary = dto.Summary ?? "",
            SourceUrl = srcUrl.Length > 1000 ? srcUrl[..1000] : srcUrl,
            Status = (dto.Status != null && ValidStatuses.Contains(dto.Status)) ? dto.Status : "todo",
            UserId = UserId
        };
        card.SetTags(dto.Tags ?? new List<string>());

        _db.Cards.Add(card);
        await _db.SaveChangesAsync();
        await transaction.CommitAsync();

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ═══════════════════════════════════════════
    // 4.4  PATCH /cards/{id}  更新卡片
    // ═══════════════════════════════════════════
    [HttpPatch("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCard(string id, UpdateCardDto dto)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId && c.DeletedAt == null);
        if (card == null)
            return NotFound(ApiResponse<object>.NotFound("卡片不存在"));

        if (dto.Title != null)
        {
            if (string.IsNullOrWhiteSpace(dto.Title))
                return BadRequest(ApiResponse<object>.BadRequest("title 不能为空"));
            card.Title = dto.Title;
        }
        if (dto.SourceText != null) card.SourceText = dto.SourceText;
        if (dto.Summary != null) card.Summary = dto.Summary;
        if (dto.SourceUrl != null)
            card.SourceUrl = dto.SourceUrl.Length > 1000 ? dto.SourceUrl[..1000] : dto.SourceUrl;
        if (dto.Tags != null) card.SetTags(dto.Tags);
        if (dto.Status != null && ValidStatuses.Contains(dto.Status))
            card.Status = dto.Status;

        card.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ═══════════════════════════════════════════
    // 4.5  PATCH /cards/{id}/archive  归档
    // ═══════════════════════════════════════════
    [HttpPatch("{id}/archive")]
    public async Task<ActionResult<ApiResponse<object>>> ArchiveCard(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId && c.DeletedAt == null);
        if (card == null)
            return NotFound(ApiResponse<object>.NotFound("卡片不存在"));

        card.Status = "archived";
        card.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ═══════════════════════════════════════════
    // 4.6  DELETE /cards/{id}  软删除
    // ═══════════════════════════════════════════
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object?>>> DeleteCard(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId && c.DeletedAt == null);
        if (card == null)
            return NotFound(ApiResponse<object?>.NotFound("卡片不存在"));

        card.DeletedAt = DateTime.UtcNow;
        card.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object?>.Ok(null, "已移入回收站"));
    }

    // ═══════════════════════════════════════════
    // 5.1  GET /cards/deleted  回收站列表
    // ═══════════════════════════════════════════
    [HttpGet("deleted")]
    public async Task<ActionResult<ApiResponse<object>>> GetDeleted(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string keyword = "",
        [FromQuery] string sort = "deletedAt",
        [FromQuery] string order = "desc")
    {
        if (pageSize > 100) pageSize = 100;
        var query = _db.Cards.Where(c => c.UserId == UserId && c.DeletedAt != null);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(c =>
                c.Title.Contains(keyword) ||
                c.Summary.Contains(keyword) ||
                c.SourceText.Contains(keyword) ||
                c.TagsJson.Contains(keyword));
        }

        query = (sort, order) switch
        {
            ("updatedAt", "asc") => query.OrderBy(c => c.UpdatedAt),
            ("updatedAt", "desc") => query.OrderByDescending(c => c.UpdatedAt),
            ("createdAt", "asc") => query.OrderBy(c => c.CreatedAt),
            ("createdAt", "desc") => query.OrderByDescending(c => c.CreatedAt),
            ("deletedAt", "asc") => query.OrderBy(c => c.DeletedAt),
            _ => query.OrderByDescending(c => c.DeletedAt)
        };

        var total = await query.CountAsync();
        var cards = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var list = cards.Select(MapToResponse).ToList();

        return Ok(ApiResponse<object>.Ok(new { list, total, page, pageSize }));
    }

    // ═══════════════════════════════════════════
    // 5.2  PATCH /cards/{id}/restore  恢复
    // ═══════════════════════════════════════════
    [HttpPatch("{id}/restore")]
    public async Task<ActionResult<ApiResponse<object>>> RestoreCard(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId && c.DeletedAt != null);
        if (card == null)
            return NotFound(ApiResponse<object>.NotFound("卡片不存在或未被删除"));

        card.DeletedAt = null;
        card.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ═══════════════════════════════════════════
    // 5.3  DELETE /cards/{id}/permanent  彻底删除
    // ═══════════════════════════════════════════
    [HttpDelete("{id}/permanent")]
    public async Task<ActionResult<ApiResponse<object?>>> PermanentDelete(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId && c.DeletedAt != null);
        if (card == null)
            return NotFound(ApiResponse<object?>.NotFound("卡片不存在或未被删除"));

        _db.Cards.Remove(card);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object?>.Ok(null, "已彻底删除"));
    }

    // ═══════════════════════════════════════════
    // 6.1  GET /cards/tags  标签汇总
    // ═══════════════════════════════════════════
    [HttpGet("tags")]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetTags()
    {
        var cards = await _db.Cards
            .Where(c => c.UserId == UserId && c.DeletedAt == null)
            .Select(c => c.TagsJson)
            .ToListAsync();

        var tagCounts = new Dictionary<string, int>();
        foreach (var json in cards)
        {
            List<string> tags;
            try { tags = JsonSerializer.Deserialize<List<string>>(json) ?? new(); }
            catch { continue; }

            foreach (var t in tags)
            {
                if (string.IsNullOrWhiteSpace(t)) continue;
                tagCounts[t] = tagCounts.GetValueOrDefault(t) + 1;
            }
        }

        var result = tagCounts
            .OrderByDescending(kv => kv.Value)
            .Select(kv => new { name = kv.Key, count = kv.Value })
            .ToList<object>();

        return Ok(ApiResponse<List<object>>.Ok(result));
    }

    // ═══════════════════════════════════════════
    // 7.1  GET /cards/overview  工作台概览
    // ═══════════════════════════════════════════
    [HttpGet("overview")]
    public async Task<ActionResult<ApiResponse<object>>> GetOverview()
    {
        var userCards = _db.Cards.Where(c => c.UserId == UserId);
        var activeCards = userCards.Where(c => c.DeletedAt == null);
        var deletedCards = userCards.Where(c => c.DeletedAt != null);

        var todoCount = await activeCards.CountAsync(c => c.Status == "todo");
        var doneCount = await activeCards.CountAsync(c => c.Status == "done");
        var archivedCount = await activeCards.CountAsync(c => c.Status == "archived");
        var deletedCount = await deletedCards.CountAsync();

        var recentCards = await activeCards
            .OrderByDescending(c => c.UpdatedAt)
            .Take(5)
            .ToListAsync();

        // topTags（复用标签聚合逻辑）
        var tagsJsonList = await activeCards.Select(c => c.TagsJson).ToListAsync();
        var tagCounts = new Dictionary<string, int>();
        foreach (var json in tagsJsonList)
        {
            List<string> tags;
            try { tags = JsonSerializer.Deserialize<List<string>>(json) ?? new(); }
            catch { continue; }
            foreach (var t in tags)
            {
                if (string.IsNullOrWhiteSpace(t)) continue;
                tagCounts[t] = tagCounts.GetValueOrDefault(t) + 1;
            }
        }
        var topTags = tagCounts
            .OrderByDescending(kv => kv.Value)
            .Take(10)
            .Select(kv => new { name = kv.Key, count = kv.Value })
            .ToList();

        return Ok(ApiResponse<object>.Ok(new
        {
            todoCount,
            doneCount,
            archivedCount,
            deletedCount,
            recentCards = recentCards.Select(MapToResponse).ToList(),
            topTags
        }));
    }

    // ═══════════════════════════════════════════
    // 4.3.1  POST /cards/{id}/organize  智能整理
    // ═══════════════════════════════════════════
    [HttpPost("{id}/organize")]
    public async Task<ActionResult<ApiResponse<OrganizeResultDto>>> Organize(string id, OrganizeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.SourceText))
            return BadRequest(ApiResponse<OrganizeResultDto>.BadRequest("sourceText 不能为空"));

        var apiKey = _config["DeepSeek:ApiKey"] ?? "";
        if (string.IsNullOrWhiteSpace(apiKey))
            return StatusCode(500, ApiResponse<OrganizeResultDto>.Fail(500, "智能整理服务未配置"));

        var clock = GetQuotaClock();
        await using (var transaction = await _db.Database.BeginTransactionAsync())
        {
            var cardReserved = await _db.Cards
                .Where(c => c.Id == id
                    && c.UserId == UserId
                    && c.DeletedAt == null
                    && c.OrganizeCount < MaxOrganizePerCard)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(c => c.OrganizeCount, c => c.OrganizeCount + 1));

            if (cardReserved == 0)
            {
                await transaction.RollbackAsync();
                var exists = await _db.Cards.AsNoTracking()
                    .AnyAsync(c => c.Id == id && c.UserId == UserId && c.DeletedAt == null);
                if (!exists)
                    return NotFound(ApiResponse<OrganizeResultDto>.NotFound("卡片不存在"));

                return StatusCode(StatusCodes.Status429TooManyRequests,
                    ApiResponse<OrganizeResultDto>.Fail(429, $"每张卡片最多智能整理 {MaxOrganizePerCard} 次"));
            }

            var dailyReserved = await _db.Database.ExecuteSqlInterpolatedAsync(
                $"""
                INSERT INTO "DailyAiUsages" ("UserId", "UsageDate", "Count", "UpdatedAt")
                VALUES ({UserId}, {clock.DateKey}, 1, {DateTime.UtcNow})
                ON CONFLICT("UserId", "UsageDate") DO UPDATE SET
                    "Count" = "Count" + 1,
                    "UpdatedAt" = excluded."UpdatedAt"
                WHERE "Count" < {MaxDailyOrganizePerUser};
                """);

            if (dailyReserved == 0)
            {
                await transaction.RollbackAsync();
                return StatusCode(StatusCodes.Status429TooManyRequests,
                    ApiResponse<OrganizeResultDto>.Fail(
                        429,
                        $"今日智能整理次数已用完，将于北京时间 {clock.ResetAt:MM-dd HH:mm} 刷新"));
            }

            await transaction.CommitAsync();
        }

        try
        {
            var result = await CallDeepSeek(dto, apiKey);
            var organizeCount = await _db.Cards.AsNoTracking()
                .Where(c => c.Id == id && c.UserId == UserId)
                .Select(c => c.OrganizeCount)
                .FirstAsync();
            var dailyCount = await _db.DailyAiUsages.AsNoTracking()
                .Where(x => x.UserId == UserId && x.UsageDate == clock.DateKey)
                .Select(x => x.Count)
                .FirstAsync();

            result.CardId = id;
            result.OrganizeCount = organizeCount;
            result.OrganizeRemaining = Math.Max(0, MaxOrganizePerCard - organizeCount);
            result.DailyRemaining = Math.Max(0, MaxDailyOrganizePerUser - dailyCount);
            result.DailyResetAt = clock.ResetAt.ToString("O");
            return Ok(ApiResponse<OrganizeResultDto>.Ok(result));
        }
        catch (TaskCanceledException)
        {
            return StatusCode(500, ApiResponse<OrganizeResultDto>.Fail(500, "智能整理超时，请稍后重试或手动填写"));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "智能整理失败");
            return StatusCode(500, ApiResponse<OrganizeResultDto>.Fail(500, "智能整理暂时不可用，请手动填写"));
        }
    }

    // ═══════════════════════════════════════════
    // 4.7  GET /cards/suggestions  搜索联想
    // ═══════════════════════════════════════════
    [HttpGet("suggestions")]
    public async Task<ActionResult<ApiResponse<object>>> GetSuggestions(
        [FromQuery] string keyword = "",
        [FromQuery] int limit = 8)
    {
        if (limit < 1) limit = 1;
        if (limit > 20) limit = 20;

        if (string.IsNullOrWhiteSpace(keyword))
            return Ok(ApiResponse<object>.Ok(new { keywords = Array.Empty<string>(), tags = Array.Empty<string>(), cards = Array.Empty<object>() }));

        var activeCards = _db.Cards.Where(c => c.UserId == UserId && c.DeletedAt == null);

        // 匹配标签
        var matchingTags = await activeCards
            .Select(c => c.TagsJson)
            .ToListAsync();

        var tagSet = new HashSet<string>();
        foreach (var json in matchingTags)
        {
            List<string> tags;
            try { tags = JsonSerializer.Deserialize<List<string>>(json) ?? new(); }
            catch { continue; }
            foreach (var t in tags)
                if (t.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                    tagSet.Add(t);
        }

        // 匹配卡片标题
        var matchingCards = await activeCards
            .Where(c => c.Title.Contains(keyword))
            .Take(limit)
            .Select(c => new { c.Id, c.Title })
            .ToListAsync();

        // 从标题中提取关键词
        var keywordSet = new HashSet<string>();
        foreach (var c in matchingCards)
        {
            var words = c.Title.Split(' ', '，', '、', '|', '/', '-', '—');
            foreach (var w in words)
                if (w.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                    keywordSet.Add(w.Trim());
        }

        return Ok(ApiResponse<object>.Ok(new
        {
            keywords = keywordSet.Take(limit).ToList(),
            tags = tagSet.Take(limit).ToList(),
            cards = matchingCards.Select(c => new { c.Id, c.Title }).ToList()
        }));
    }

    // ═══════════════════════════════════════════
    // DeepSeek API 调用
    // ═══════════════════════════════════════════
    private async Task<OrganizeResultDto> CallDeepSeek(OrganizeDto dto, string apiKey)
    {
        var client = _http.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(30);
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

        var presetTags = _config.GetSection("PresetTags").Get<List<string>>() ?? new List<string>();
        var tagList = string.Join("、", presetTags);

        var prompt = $@"你是一个知识整理助手。请根据用户提供的学习材料，生成以下内容：

1. 标题（简洁，最长30字）
2. 摘要（1-2句话概括核心内容，最长200字）
3. 标签（2-4个，优先从以下预设标签中选择：{tagList}；如果没有匹配的，可以建议1个新标签）

请务必按以下 JSON 格式返回，不要包含其他文字：
{{ ""title"": ""建议标题"", ""summary"": ""建议摘要"", ""tags"": [""标签1"", ""标签2""] }}

学习材料：
{dto.SourceText}";

        var requestBody = new
        {
            model = "deepseek-chat",
            messages = new[]
            {
                new { role = "system", content = "你是一个知识整理助手，只返回 JSON 格式的结果，不输出其他内容。" },
                new { role = "user", content = prompt }
            },
            temperature = 0.7,
            max_tokens = 1024
        };

        var apiUrl = _config["DeepSeek:ApiUrl"] ?? "https://api.deepseek.com/chat/completions";
        var response = await client.PostAsJsonAsync(apiUrl, requestBody);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<DeepSeekResponse>();
        var content = body?.Choices?.FirstOrDefault()?.Message?.Content?.Trim() ?? "";

        // 清理 AI 返回的 markdown 代码块标记
        if (content.StartsWith("```")) content = content[(content.IndexOf('\n') + 1)..];
        if (content.EndsWith("```")) content = content[..content.LastIndexOf("```")];

        try
        {
            var organized = JsonSerializer.Deserialize<OrganizeResultDto>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return organized ?? new OrganizeResultDto { Title = "未能解析", Summary = content };
        }
        catch
        {
            return new OrganizeResultDto { Title = "整理中...", Summary = content };
        }
    }

    // DeepSeek API 响应模型
    private class DeepSeekResponse
    {
        public List<DeepSeekChoice>? Choices { get; set; }
    }

    private class DeepSeekChoice
    {
        public DeepSeekMessage? Message { get; set; }
    }

    private class DeepSeekMessage
    {
        public string? Content { get; set; }
    }

    // ═══════════════════════════════════════════
    // 辅助：卡片 → API 响应对象
    // ═══════════════════════════════════════════
    private static bool TextContains(string? source, string keyword) =>
        !string.IsNullOrEmpty(source) && source.Contains(keyword, StringComparison.OrdinalIgnoreCase);

    private object MapToResponse(KnowledgeCard c) => new
    {
        c.Id,
        c.UserId,
        c.Title,
        c.SourceText,
        c.Summary,
        c.SourceUrl,
        tags = c.GetTags(),
        c.Status,
        c.OrganizeCount,
        organizeRemaining = Math.Max(0, MaxOrganizePerCard - c.OrganizeCount),
        c.CreatedAt,
        c.UpdatedAt,
        c.DeletedAt
    };

    private object BuildQuotaResponse(int totalCardsCreated, int dailyCount, DateTimeOffset resetAt) => new
    {
        cardQuota = new
        {
            created = totalCardsCreated,
            limit = MaxCardsPerUser,
            remaining = Math.Max(0, MaxCardsPerUser - totalCardsCreated),
            reached = totalCardsCreated >= MaxCardsPerUser
        },
        aiQuota = new
        {
            usedToday = dailyCount,
            dailyLimit = MaxDailyOrganizePerUser,
            remainingToday = Math.Max(0, MaxDailyOrganizePerUser - dailyCount),
            resetAt = resetAt.ToString("O")
        }
    };

    private (string DateKey, DateTimeOffset ResetAt) GetQuotaClock()
    {
        var configuredId = _config["Limits:TimeZoneId"] ?? "Asia/Shanghai";
        TimeZoneInfo timeZone;
        try
        {
            timeZone = TimeZoneInfo.FindSystemTimeZoneById(configuredId);
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            try
            {
                timeZone = TimeZoneInfo.FindSystemTimeZoneById("China Standard Time");
            }
            catch (Exception fallbackEx) when (fallbackEx is TimeZoneNotFoundException or InvalidTimeZoneException)
            {
                timeZone = TimeZoneInfo.CreateCustomTimeZone(
                    "Asia/Shanghai",
                    TimeSpan.FromHours(8),
                    "China Standard Time",
                    "China Standard Time");
            }
        }

        var localNow = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, timeZone);
        var tomorrow = localNow.Date.AddDays(1);
        var resetAt = new DateTimeOffset(tomorrow, timeZone.GetUtcOffset(tomorrow));
        return (localNow.ToString("yyyy-MM-dd"), resetAt);
    }
}
