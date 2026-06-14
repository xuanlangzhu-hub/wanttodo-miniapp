namespace WantTodo.Api.DTOs;

/// <summary>
/// 统一 API 响应格式：{ code, message, data }
/// </summary>
public class ApiResponse<T>
{
    public int Code { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }

    public static ApiResponse<T> Ok(T data, string? message = null)
        => new() { Code = 200, Message = message, Data = data };

    public static ApiResponse<T> Fail(int code, string message)
        => new() { Code = code, Message = message, Data = default };

    public static ApiResponse<T> NotFound(string message = "资源不存在")
        => new() { Code = 404, Message = message, Data = default };

    public static ApiResponse<T> BadRequest(string message)
        => new() { Code = 400, Message = message, Data = default };

    public static ApiResponse<T> Unauthorized(string message = "未登录或 token 已过期")
        => new() { Code = 401, Message = message, Data = default };
}
