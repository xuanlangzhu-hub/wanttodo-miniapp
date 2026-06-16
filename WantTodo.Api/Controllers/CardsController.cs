using System.Security.Claims;
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

    public CardsController(AppDbContext db) => _db = db;

    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    private static readonly HashSet<string> ValidStatuses = new() { "todo", "done", "archived" };

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
        var query = _db.Cards.Where(c => c.UserId == UserId && c.DeletedAt == null);

        // 状态筛选
        query = status switch
        {
            "todo" => query.Where(c => c.Status == "todo"),
            "done" => query.Where(c => c.Status == "done"),
            "archived" => query.Where(c => c.Status == "archived"),
            _ => query
        };

        // 关键词搜索（标题/摘要/原文/标签）
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(c =>
                c.Title.Contains(keyword) ||
                c.Summary.Contains(keyword) ||
                c.SourceText.Contains(keyword) ||
                c.TagsJson.Contains(keyword));
        }

        // 按标签筛选
        if (!string.IsNullOrWhiteSpace(tag))
        {
            query = query.Where(c => c.TagsJson.Contains(tag));
        }

        // 排序
        query = (sort, order) switch
        {
            ("createdAt", "asc") => query.OrderBy(c => c.CreatedAt),
            ("createdAt", "desc") => query.OrderByDescending(c => c.CreatedAt),
            ("updatedAt", "asc") => query.OrderBy(c => c.UpdatedAt),
            _ => query.OrderByDescending(c => c.UpdatedAt)
        };

        var total = await query.CountAsync();
        var cards = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var list = cards.Select(MapToResponse).ToList();

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
    // 4.3  POST /cards  创建卡片
    // ═══════════════════════════════════════════
    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> CreateCard(CreateCardDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(ApiResponse<object>.BadRequest("title 不能为空"));

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

        if (dto.Title != null) card.Title = dto.Title;
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
    // 辅助：卡片 → API 响应对象
    // ═══════════════════════════════════════════
    private static object MapToResponse(KnowledgeCard c) => new
    {
        c.Id,
        c.UserId,
        c.Title,
        c.SourceText,
        c.Summary,
        c.SourceUrl,
        tags = c.GetTags(),
        c.Status,
        c.CreatedAt,
        c.UpdatedAt,
        c.DeletedAt
    };
}
