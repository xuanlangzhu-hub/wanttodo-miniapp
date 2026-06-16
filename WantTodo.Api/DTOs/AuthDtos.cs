namespace WantTodo.Api.DTOs;

// 微信登录请求
public class WechatLoginDto
{
    public string Code { get; set; } = string.Empty;
}

// 登录响应
public class LoginResultDto
{
    public string Token { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
    public UserInfoDto UserInfo { get; set; } = new();
}

public class UserInfoDto
{
    public string UserId { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
}

// 用户信息响应
public class UserProfileDto
{
    public string UserId { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
}
