using System.Text.Json;
using System.Text.Json.Serialization;
using Recall.Models;

namespace Recall.Services;

public class VerseService
{
    private readonly IReadOnlyList<VerseCollection> _collections;
    private readonly IReadOnlyDictionary<string, BibleVerse> _verses;

    public VerseService(IWebHostEnvironment environment)
    {
        var path = Path.Combine(environment.ContentRootPath, "Data", "verses.json");
        var json = File.ReadAllText(path);
        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };

        var data = JsonSerializer.Deserialize<VerseDataFile>(json, options)
            ?? throw new InvalidOperationException("Failed to load verse data.");

        _collections = data.Collections;
        _verses = data.Verses.ToDictionary(v => v.Id);
    }

    public IReadOnlyList<VerseCollection> GetCollections() => _collections;

    public IReadOnlyList<BibleVerse> GetVerses(string? collectionId = null)
    {
        var verses = _verses.Values.AsEnumerable();

        if (!string.IsNullOrWhiteSpace(collectionId))
        {
            verses = verses.Where(v => v.CollectionId == collectionId);
        }

        return verses.OrderBy(v => v.CollectionId).ThenBy(v => v.Order).ToList();
    }

    public BibleVerse? GetVerse(string id) =>
        _verses.TryGetValue(id, out var verse) ? verse : null;

    private sealed class VerseDataFile
    {
        [JsonPropertyName("collections")]
        public List<VerseCollection> Collections { get; set; } = [];

        [JsonPropertyName("verses")]
        public List<BibleVerse> Verses { get; set; } = [];
    }
}
