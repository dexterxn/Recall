using Recall.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();
builder.Services.AddSingleton<VerseService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
}

app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapGet("/api/collections", (VerseService verses) => verses.GetCollections());
app.MapGet("/api/verses", (VerseService verses, string? collection) => verses.GetVerses(collection));
app.MapGet("/api/verses/{id}", (VerseService verses, string id) =>
{
    var verse = verses.GetVerse(id);
    return verse is null ? Results.NotFound() : Results.Ok(verse);
});

app.MapRazorPages();

app.Run();
