namespace WantTodo.Api.DTOs;

// 智能整理请求
public class OrganizeDto
{
    public string SourceText { get; set; } = string.Empty;
    public string? SourceUrl { get; set; }
}

// 智能整理响应
public class OrganizeResultDto
{
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public string Status { get; set; } = "todo";
}
