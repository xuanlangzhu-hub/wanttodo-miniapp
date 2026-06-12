using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WantTodo.Api.Data;
using WantTodo.Api.DTOs;
using WantTodo.Api.Models;

namespace WantTodo.Api.Controllers;

[ApiController]
[Route("api/v1/todos")]
[Authorize]
public class TodosController : ControllerBase
{
    private readonly AppDbContext _db;

    public TodosController(AppDbContext db) => _db = db;

    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    // ── GET /api/v1/todos ──
    [HttpGet]
    public async Task<ActionResult<ApiResponse<object>>> GetTodos(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string status = "all",
        [FromQuery] string sort = "createdAt",
        [FromQuery] string order = "desc")
    {
        var query = _db.Todos.Where(t => t.UserId == UserId);

        // 筛选
        query = status switch
        {
            "active" => query.Where(t => !t.Completed),
            "completed" => query.Where(t => t.Completed),
            _ => query
        };

        // 排序
        query = (sort, order) switch
        {
            ("priority", "asc") => query.OrderBy(t => t.Priority),
            ("priority", "desc") => query.OrderByDescending(t => t.Priority),
            ("dueDate", "asc") => query.OrderBy(t => t.DueDate),
            ("dueDate", "desc") => query.OrderByDescending(t => t.DueDate),
            ("createdAt", "asc") => query.OrderBy(t => t.CreatedAt),
            _ => query.OrderByDescending(t => t.CreatedAt) // 默认
        };

        var total = await query.CountAsync();
        var list = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            list,
            total,
            page,
            pageSize
        }));
    }

    // ── POST /api/v1/todos ──
    [HttpPost]
    public async Task<ActionResult<ApiResponse<Todo>>> CreateTodo(CreateTodoDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(ApiResponse<Todo>.BadRequest("title 不能为空"));

        var todo = new Todo
        {
            Title = dto.Title,
            Description = dto.Description ?? "",
            Priority = dto.Priority ?? 2,
            DueDate = dto.DueDate,
            UserId = UserId
        };

        _db.Todos.Add(todo);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<Todo>.Ok(todo));
    }

    // ── PATCH /api/v1/todos/{id} ──
    [HttpPatch("{id}")]
    public async Task<ActionResult<ApiResponse<Todo>>> UpdateTodo(string id, UpdateTodoDto dto)
    {
        var todo = await _db.Todos.FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
        if (todo == null)
            return NotFound(ApiResponse<Todo>.NotFound());

        if (dto.Title != null) todo.Title = dto.Title;
        if (dto.Description != null) todo.Description = dto.Description;
        if (dto.Completed.HasValue) todo.Completed = dto.Completed.Value;
        if (dto.Priority.HasValue) todo.Priority = dto.Priority.Value;
        if (dto.DueDate != null) todo.DueDate = dto.DueDate;
        todo.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<Todo>.Ok(todo));
    }

    // ── DELETE /api/v1/todos/{id} ──
    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object?>>> DeleteTodo(string id)
    {
        var todo = await _db.Todos.FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
        if (todo == null)
            return NotFound(ApiResponse<object?>.NotFound());

        _db.Todos.Remove(todo);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object?>.Ok(null, "已删除"));
    }

    // ── PATCH /api/v1/todos/batch ──
    [HttpPatch("batch")]
    public async Task<ActionResult<ApiResponse<BatchResultDto>>> BatchTodos(BatchTodoDto dto)
    {
        var results = new List<BatchItemResult>();
        var idsToDelete = new List<string>();

        foreach (var id in dto.Ids)
        {
            var todo = await _db.Todos.FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId);
            if (todo == null)
            {
                results.Add(new BatchItemResult { Id = id, Success = false, Message = "Todo 不存在" });
                continue;
            }

            string message;

            if (dto.Action == "complete")
            {
                message = "已完成";
                todo.Completed = true;
                todo.UpdatedAt = DateTime.UtcNow;
            }
            else if (dto.Action == "uncomplete")
            {
                message = "已取消完成";
                todo.Completed = false;
                todo.UpdatedAt = DateTime.UtcNow;
            }
            else if (dto.Action == "delete")
            {
                message = "已删除";
                _db.Todos.Remove(todo);
            }
            else
            {
                message = "未知操作";
            }

            results.Add(new BatchItemResult { Id = id, Success = true, Message = message });
        }

        await _db.SaveChangesAsync();

        var batchResult = new BatchResultDto
        {
            Total = dto.Ids.Count,
            SuccessCount = results.Count(r => r.Success),
            FailedCount = results.Count(r => !r.Success),
            Results = results.OrderBy(r => dto.Ids.IndexOf(r.Id)).ToList()
        };

        return Ok(ApiResponse<BatchResultDto>.Ok(batchResult, "success"));
    }
}
