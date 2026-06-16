using System.Text.Json;
using System.Text.Json.Serialization;

namespace WantTodo.Api.Models;

public class KnowledgeCard
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string Title { get; set; } = string.Empty;
    public string SourceText { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;

    // tags 存为 JSON 字符串：["AI","Python"]
    public string TagsJson { get; set; } = "[]";

    public string Status { get; set; } = "todo"; // todo / done / archived
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // 软删除
    public DateTime? DeletedAt { get; set; }

    // 外键（userId 按契约返回给前端，User 导航属性隐藏）
    public string UserId { get; set; } = string.Empty;
    [JsonIgnore]
    public User? User { get; set; }

    // 辅助方法：Tags 读写
    public List<string> GetTags()
    {
        try { return JsonSerializer.Deserialize<List<string>>(TagsJson) ?? new List<string>(); }
        catch { return new List<string>(); }
    }

    public void SetTags(List<string> tags)
    {
        TagsJson = JsonSerializer.Serialize(tags);
    }
}
