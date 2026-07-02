using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using WantTodo.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// ── 数据库 ──
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

// ── JWT 鉴权 ──
var jwtKey = builder.Configuration["Jwt:Key"];
var devDefaultKey = "wanttodo-dev-key-2026-change-in-production";

// 生产环境禁止使用默认密钥
if (!builder.Environment.IsDevelopment() && (string.IsNullOrEmpty(jwtKey) || jwtKey == devDefaultKey))
    throw new InvalidOperationException("生产环境必须配置 Jwt:Key，不能使用默认开发密钥");

jwtKey ??= devDefaultKey;

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// ── HttpClient（微信接口调用）──
builder.Services.AddHttpClient();

// ── Controllers ──
builder.Services.AddControllers();

// ── OpenAPI（开发用）──
builder.Services.AddOpenApi();

// ── CORS（允许小程序调试）──
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// ── 启动摘要日志 ──
var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("WantTodo API 启动 | 环境: {Env} | 数据库: SQLite | 端口: {Url}",
    app.Environment.EnvironmentName,
    app.Urls.FirstOrDefault() ?? "5000");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── 数据库初始化与轻量升级（保留现有 SQLite 数据）──
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DatabaseSchemaInitializer.InitializeAsync(db);
}

app.Run();
