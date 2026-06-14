using System.Security.Claims;
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

    // ── GET /api/v1/cards ──
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetCards(
        [FromQuery] string status = "all",
        [FromQuery] string sort = "updatedAt",
        [FromQuery] string order = "desc",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.Cards.Where(c => c.UserId == UserId);

        // 状态筛选
        query = status switch
        {
            "todo" => query.Where(c => c.Status == "todo"),
            "done" => query.Where(c => c.Status == "done"),
            "archived" => query.Where(c => c.Status == "archived"),
            _ => query
        };

        // 排序
        query = (sort, order) switch
        {
            ("createdAt", "asc") => query.OrderBy(c => c.CreatedAt),
            ("createdAt", "desc") => query.OrderByDescending(c => c.CreatedAt),
            ("title", "asc") => query.OrderBy(c => c.Title),
            ("title", "desc") => query.OrderByDescending(c => c.Title),
            ("updatedAt", "asc") => query.OrderBy(c => c.UpdatedAt),
            _ => query.OrderByDescending(c => c.UpdatedAt) // 默认
        };

        var total = await query.CountAsync();
        var cards = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var list = cards.Select(c => MapToResponse(c)).ToList();

        return Ok(ApiResponse<object>.Ok(new { list, total, page, pageSize }));
    }

    // ── GET /api/v1/cards/{id} ──
    [HttpGet("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> GetCard(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId);
        if (card == null)
            return NotFound(ApiResponse<object>.NotFound("卡片不存在"));

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ── POST /api/v1/cards ──
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
            Status = "todo",
            UserId = UserId
        };
        card.SetTags(dto.Tags ?? new List<string>());

        _db.Cards.Add(card);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ── PATCH /api/v1/cards/{id} ──
    [HttpPatch("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> UpdateCard(string id, UpdateCardDto dto)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId);
        if (card == null)
            return NotFound(ApiResponse<object>.NotFound("卡片不存在"));

        if (dto.Title != null) card.Title = dto.Title;
        if (dto.SourceText != null) card.SourceText = dto.SourceText;
        if (dto.Summary != null) card.Summary = dto.Summary;
        if (dto.SourceUrl != null)
            card.SourceUrl = dto.SourceUrl.Length > 1000
                ? dto.SourceUrl[..1000]
                : dto.SourceUrl;
        if (dto.Tags != null) card.SetTags(dto.Tags);
        if (dto.Status != null && IsValidStatus(dto.Status))
            card.Status = dto.Status;

        card.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ── DELETE /api/v1/cards/{id} ──
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object?>>> DeleteCard(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId);
        if (card == null)
            return NotFound(ApiResponse<object?>.NotFound("卡片不存在"));

        _db.Cards.Remove(card);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object?>.Ok(null, "已删除"));
    }

    // ── PATCH /api/v1/cards/{id}/archive ──
    [HttpPatch("{id}/archive")]
    public async Task<ActionResult<ApiResponse<object>>> ArchiveCard(string id)
    {
        var card = await _db.Cards.FirstOrDefaultAsync(c => c.Id == id && c.UserId == UserId);
        if (card == null)
            return NotFound(ApiResponse<object>.NotFound("卡片不存在"));

        card.Status = "archived";
        card.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(MapToResponse(card)));
    }

    // ── 辅助 ──
    private static readonly HashSet<string> ValidStatuses = new() { "todo", "done", "archived" };

    private bool IsValidStatus(string status) => ValidStatuses.Contains(status);

    private static object MapToResponse(KnowledgeCard c) => new
    {
        c.Id,
        c.Title,
        c.SourceText,
        c.Summary,
        c.SourceUrl,
        tags = c.GetTags(),
        c.Status,
        c.CreatedAt,
        c.UpdatedAt
    };
}
