using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WantTodo.Api.Data;
using WantTodo.Api.DTOs;
using WantTodo.Api.Models;

namespace WantTodo.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _http;

    public AuthController(AppDbContext db, IConfiguration config, IHttpClientFactory http)
    {
        _db = db;
        _config = config;
        _http = http;
    }

    // ── GET /api/v1/auth/dev-token（仅开发环境）──
    [HttpGet("dev-token")]
    public ActionResult<ApiResponse<LoginResultDto>> DevToken()
    {
        if (!_config.GetValue<bool>("DevMode"))
            return NotFound();

        var userId = "test_user_01";
        var jwtKey = _config["Jwt:Key"] ?? "wanttodo-dev-key-2026";
        var expiresIn = 7200;
        var token = GenerateJwt(userId, jwtKey, expiresIn);

        var result = new LoginResultDto
        {
            Token = token,
            ExpiresIn = expiresIn,
            UserInfo = new UserInfoDto
            {
                UserId = userId,
                Nickname = "测试用户",
                AvatarUrl = ""
            }
        };
        return Ok(ApiResponse<LoginResultDto>.Ok(result));
    }

    // ── POST /api/v1/auth/wechat-login ──
    [HttpPost("wechat-login")]
    public async Task<ActionResult<ApiResponse<LoginResultDto>>> WechatLogin(WechatLoginDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(ApiResponse<LoginResultDto>.BadRequest("code 不能为空"));

        // 调用微信接口，用 code 换 openId
        var appId = _config["Wechat:AppId"] ?? "";
        var appSecret = _config["Wechat:AppSecret"] ?? "";

        string openId;
        try
        {
            openId = await ExchangeCodeForOpenId(appId, appSecret, dto.Code);
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<LoginResultDto>.BadRequest($"微信登录失败: {ex.Message}"));
        }

        // 查找或创建用户
        var user = await _db.Users.FirstOrDefaultAsync(u => u.OpenId == openId);
        if (user == null)
        {
            user = new User { OpenId = openId, Nickname = "微信用户" };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }

        // 生成 JWT
        var jwtKey = _config["Jwt:Key"] ?? "wanttodo-dev-key-2026";
        var expiresIn = 7200;
        var token = GenerateJwt(user.Id, jwtKey, expiresIn);

        var result = new LoginResultDto
        {
            Token = token,
            ExpiresIn = expiresIn,
            UserInfo = new UserInfoDto
            {
                UserId = user.Id,
                Nickname = user.Nickname,
                AvatarUrl = user.AvatarUrl
            }
        };

        return Ok(ApiResponse<LoginResultDto>.Ok(result));
    }

    // ── 微信 code2Session ──
    private async Task<string> ExchangeCodeForOpenId(string appId, string appSecret, string code)
    {
        var url = $"https://api.weixin.qq.com/sns/jscode2session?appid={appId}&secret={appSecret}&js_code={code}&grant_type=authorization_code";
        var client = _http.CreateClient();
        var response = await client.GetFromJsonAsync<WechatSessionResponse>(url);

        if (response == null || !string.IsNullOrEmpty(response.ErrCode))
            throw new Exception(response?.ErrMsg ?? "微信接口无响应");

        return response.OpenId ?? "";
    }

    // ── 生成 JWT ──
    private string GenerateJwt(string userId, string key, int expiresIn)
    {
        var keyBytes = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(keyBytes, SecurityAlgorithms.HmacSha256);
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, userId) };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddSeconds(expiresIn),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// 微信 code2Session 响应
public class WechatSessionResponse
{
    public string? OpenId { get; set; }
    public string? SessionKey { get; set; }
    public string? UnionId { get; set; }
    public string? ErrCode { get; set; }
    public string? ErrMsg { get; set; }
}
