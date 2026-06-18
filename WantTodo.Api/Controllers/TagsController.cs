using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WantTodo.Api.DTOs;

namespace WantTodo.Api.Controllers;

[ApiController]
[Route("api/v1/tags")]
[Authorize]
public class TagsController : ControllerBase
{
    private readonly IConfiguration _config;

    public TagsController(IConfiguration config) => _config = config;

    // ── GET /api/v1/tags/presets ──
    [HttpGet("presets")]
    public ActionResult<ApiResponse<List<string>>> GetPresets()
    {
        var presets = _config.GetSection("PresetTags").Get<List<string>>() ?? new List<string>();
        return Ok(ApiResponse<List<string>>.Ok(presets));
    }
}
