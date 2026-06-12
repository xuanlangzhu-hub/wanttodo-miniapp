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

    // 外键
    public string UserId { get; set; } = string.Empty;
    public User? User { get; set; }
}
