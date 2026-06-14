namespace WantTodo.Api.Models;

public class User
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string OpenId { get; set; } = string.Empty;
    public string Nickname { get; set; } = string.Empty;
    public string AvatarUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<KnowledgeCard> Cards { get; set; } = new List<KnowledgeCard>();
}
