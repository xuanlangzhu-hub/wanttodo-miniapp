namespace WantTodo.Api.DTOs;

// 创建 Todo
public class CreateTodoDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? Priority { get; set; }
    public DateTime? DueDate { get; set; }
}

// 更新 Todo（所有字段可选）
public class UpdateTodoDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public bool? Completed { get; set; }
    public int? Priority { get; set; }
    public DateTime? DueDate { get; set; }
}

// 批量操作
public class BatchTodoDto
{
    public List<string> Ids { get; set; } = new();
    public string Action { get; set; } = string.Empty; // complete / uncomplete / delete
}

// 批量操作结果
public class BatchResultDto
{
    public int Total { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
    public List<BatchItemResult> Results { get; set; } = new();
}

public class BatchItemResult
{
    public string Id { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
}
