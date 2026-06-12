using Microsoft.EntityFrameworkCore;
using WantTodo.Api.Models;

namespace WantTodo.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Todo> Todos => Set<Todo>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Todo>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.Title).HasMaxLength(200).IsRequired();
            entity.Property(t => t.Description).HasMaxLength(1000).HasDefaultValue("");
            entity.Property(t => t.Completed).HasDefaultValue(false);
            entity.Property(t => t.Priority).HasDefaultValue(2);
            entity.HasOne(t => t.User)
                  .WithMany(u => u.Todos)
                  .HasForeignKey(t => t.UserId);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.OpenId).IsUnique();
            entity.Property(u => u.OpenId).HasMaxLength(64).IsRequired();
            entity.Property(u => u.Nickname).HasMaxLength(100);
            entity.Property(u => u.AvatarUrl).HasMaxLength(500);
        });
    }
}
