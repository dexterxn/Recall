namespace Recall.Models;

public record BibleVerse(
    string Id,
    string Reference,
    string Text,
    string CollectionId,
    int Order);

public record VerseCollection(
    string Id,
    string Name,
    string Description);

public record VerseProgress(
    string VerseId,
    string Stage,
    int Accuracy,
    int BestWpm,
    int ReviewCount,
    DateTime? LastReviewed);

public static class MemorizationStages
{
    public const string TypeIt = "type-it";
    public const string MemorizeIt = "memorize-it";
    public const string MasterIt = "master-it";

    public static readonly string[] All = [TypeIt, MemorizeIt, MasterIt];

    public static string DisplayName(string stage) => stage switch
    {
        TypeIt => "Type It",
        MemorizeIt => "Memorize It",
        MasterIt => "Master It",
        _ => stage
    };

    public static string? Next(string stage) => stage switch
    {
        TypeIt => MemorizeIt,
        MemorizeIt => MasterIt,
        _ => null
    };
}
