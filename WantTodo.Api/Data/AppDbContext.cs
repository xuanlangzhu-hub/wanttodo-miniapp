using Microsoft.EntityFrameworkCore;
using WantTodo.Api.Models;

namespace WantTodo.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<KnowledgeCard> Cards => Set<KnowledgeCard>();
    public DbSet<User> Users => Set<User>();
    public DbSet<DailyAiUsage> DailyAiUsages => Set<DailyAiUsage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<KnowledgeCard>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Title).HasMaxLength(200).IsRequired();
            entity.Property(c => c.SourceText).HasMaxLength(5000).HasDefaultValue("");
            entity.Property(c => c.Summary).HasMaxLength(2000).HasDefaultValue("");
            entity.Property(c => c.SourceUrl).HasMaxLength(1000).HasDefaultValue("");
            entity.Property(c => c.TagsJson).HasMaxLength(2000).HasDefaultValue("[]");
            entity.Property(c => c.Status).HasMaxLength(20).HasDefaultValue("todo");
            entity.Property(c => c.OrganizeCount).HasDefaultValue(0);
            entity.HasOne(c => c.User)
                  .WithMany(u => u.Cards)
                  .HasForeignKey(c => c.UserId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.OpenId).IsUnique();
            entity.Property(u => u.OpenId).HasMaxLength(64).IsRequired();
            entity.Property(u => u.Nickname).HasMaxLength(100);
            entity.Property(u => u.AvatarUrl).HasMaxLength(500);
            entity.Property(u => u.TotalCardsCreated).HasDefaultValue(0);
        });

        modelBuilder.Entity<DailyAiUsage>(entity =>
        {
            entity.HasKey(x => new { x.UserId, x.UsageDate });
            entity.Property(x => x.UsageDate).HasMaxLength(10);
            entity.Property(x => x.Count).HasDefaultValue(0);
            entity.HasOne(x => x.User)
                  .WithMany(u => u.DailyAiUsages)
                  .HasForeignKey(x => x.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
