using System.Data.Common;
using Microsoft.EntityFrameworkCore;

namespace WantTodo.Api.Data;

public static class DatabaseSchemaInitializer
{
    public static async Task InitializeAsync(AppDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        if (!db.Database.IsSqlite())
            return;

        var userColumns = await GetColumnsAsync(db, "Users");
        var addedTotalCardsCreated = !userColumns.Contains("TotalCardsCreated");
        if (addedTotalCardsCreated)
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Users\" ADD COLUMN \"TotalCardsCreated\" INTEGER NOT NULL DEFAULT 0;");
        }

        var cardColumns = await GetColumnsAsync(db, "Cards");
        if (!cardColumns.Contains("OrganizeCount"))
        {
            await db.Database.ExecuteSqlRawAsync(
                "ALTER TABLE \"Cards\" ADD COLUMN \"OrganizeCount\" INTEGER NOT NULL DEFAULT 0;");
        }

        await db.Database.ExecuteSqlRawAsync(
            """
            CREATE TABLE IF NOT EXISTS "DailyAiUsages" (
                "UserId" TEXT NOT NULL,
                "UsageDate" TEXT NOT NULL,
                "Count" INTEGER NOT NULL DEFAULT 0,
                "UpdatedAt" TEXT NOT NULL,
                CONSTRAINT "PK_DailyAiUsages" PRIMARY KEY ("UserId", "UsageDate"),
                CONSTRAINT "FK_DailyAiUsages_Users_UserId"
                    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            """);

        if (addedTotalCardsCreated)
        {
            await db.Database.ExecuteSqlRawAsync(
                """
                UPDATE "Users"
                SET "TotalCardsCreated" = (
                    SELECT COUNT(*)
                    FROM "Cards"
                    WHERE "Cards"."UserId" = "Users"."Id"
                );
                """);
        }
    }

    private static async Task<HashSet<string>> GetColumnsAsync(AppDbContext db, string tableName)
    {
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var connection = db.Database.GetDbConnection();
        var shouldClose = connection.State != System.Data.ConnectionState.Open;

        if (shouldClose)
            await connection.OpenAsync();

        try
        {
            await using DbCommand command = connection.CreateCommand();
            command.CommandText = $"PRAGMA table_info(\"{tableName}\");";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                columns.Add(reader.GetString(1));
        }
        finally
        {
            if (shouldClose)
                await connection.CloseAsync();
        }

        return columns;
    }
}
