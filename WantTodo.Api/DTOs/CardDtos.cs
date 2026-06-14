namespace WantTodo.Api.DTOs;

// 创建卡片
public class CreateCardDto
{
    public string Title { get; set; } = string.Empty;
    public string? SourceText { get; set; }
    public string? Summary { get; set; }
    public string? SourceUrl { get; set; }
    public List<string>? Tags { get; set; }
}

// 更新卡片（所有字段可选）
public class UpdateCardDto
{
    public string? Title { get; set; }
    public string? SourceText { get; set; }
    public string? Summary { get; set; }
    public string? SourceUrl { get; set; }
    public List<string>? Tags { get; set; }
    public string? Status { get; set; }
}
