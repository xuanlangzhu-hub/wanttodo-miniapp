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
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<AuthController> _logger;

    public AuthController(AppDbContext db, IConfiguration config, IHttpClientFactory http,
        IWebHostEnvironment env, ILogger<AuthController> logger)
    {
        _db = db;
        _config = config;
        _http = http;
        _env = env;
        _logger = logger;
    }

    // ── GET /api/v1/auth/dev-token（双重门禁：仅开发环境 + DevMode）──
    [HttpGet("dev-token")]
    public async Task<ActionResult<ApiResponse<LoginResultDto>>> DevToken()
    {
        if (!_env.IsDevelopment() || !_config.GetValue<bool>("DevMode"))
            return NotFound();

        var userId = "test_user_01";
        // 自动创建测试用户（如果不存在）
        if (!await _db.Users.AnyAsync(u => u.Id == userId))
        {
            _db.Users.Add(new User { Id = userId, OpenId = "test_openid", Nickname = "测试用户" });
            await _db.SaveChangesAsync();
        }
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

        var appId = _config["Wechat:AppId"] ?? "";
        var appSecret = _config["Wechat:AppSecret"] ?? "";

        string openId;
        try
        {
            openId = await ExchangeCodeForOpenId(appId, appSecret, dto.Code);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "微信登录 code2Session 失败");
            return BadRequest(ApiResponse<LoginResultDto>.BadRequest("微信登录失败，请稍后重试"));
        }

        // openId 不能为空
        if (string.IsNullOrWhiteSpace(openId))
        {
            _logger.LogWarning("微信登录返回空 openId");
            return BadRequest(ApiResponse<LoginResultDto>.BadRequest("微信登录失败，请稍后重试"));
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

        if (response == null || (response.ErrCode.HasValue && response.ErrCode.Value != 0))
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
    [System.Text.Json.Serialization.JsonPropertyName("openid")]
    public string? OpenId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("session_key")]
    public string? SessionKey { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("unionid")]
    public string? UnionId { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("errcode")]
    public int? ErrCode { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("errmsg")]
    public string? ErrMsg { get; set; }
}
