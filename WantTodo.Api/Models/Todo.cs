namespace WantTodo.Api.Models;

public class Todo
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool Completed { get; set; }
    public int Priority { get; set; } = 2; // 0=无, 1=高, 2=中, 3=低
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // 外键（不序列化到 API 响应）
    [System.Text.Json.Serialization.JsonIgnore]
    public string UserId { get; set; } = string.Empty;
    [System.Text.Json.Serialization.JsonIgnore]
    public User? User { get; set; }
}
