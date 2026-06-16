using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WantTodo.Api.Data;
using WantTodo.Api.DTOs;

namespace WantTodo.Api.Controllers;

[ApiController]
[Route("api/v1/user")]
[Authorize]
public class UserController : ControllerBase
{
    private readonly AppDbContext _db;

    public UserController(AppDbContext db) => _db = db;

    private string UserId =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;

    // ── GET /api/v1/user/profile ──
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> GetProfile()
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == UserId);

        if (user == null)
            return NotFound(ApiResponse<UserProfileDto>.NotFound("用户不存在"));

        var profile = new UserProfileDto
        {
            UserId = user.Id,
            Nickname = user.Nickname,
            AvatarUrl = user.AvatarUrl
        };

        return Ok(ApiResponse<UserProfileDto>.Ok(profile));
    }
}
