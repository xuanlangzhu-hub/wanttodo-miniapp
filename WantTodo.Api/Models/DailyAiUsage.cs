namespace WantTodo.Api.Models;

public class DailyAiUsage
{
    public string UserId { get; set; } = string.Empty;
    public string UsageDate { get; set; } = string.Empty;
    public int Count { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
