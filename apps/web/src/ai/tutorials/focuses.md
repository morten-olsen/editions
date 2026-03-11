# Focuses

Focuses are topic areas that automatically classify articles. When you create a focus called "Technology", the system uses an on-device AI classifier to score how well each article matches that topic.

## Creating a focus (UI flow)

1. Navigate to /focuses/new (or click the + icon next to "Browse" in the sidebar)
2. Fill in the form fields:
   - **focus-name** — the topic name. Be descriptive: "Artificial Intelligence" works better than "AI" for classification.
   - **focus-description** — optional description that helps the classifier.
   - **Minimum confidence slider** — threshold for article matching. Default (0%) is usually fine.
3. **Add sources** — scroll down to the "Source selection" section. Each source appears as a checkbox (e.g., `focus-source-{id}`). Click the checkbox to toggle it. When checked, additional options appear for article selection mode and priority.
   - To select a source: click the element with id `focus-source-{sourceId}` — this toggles the checkbox.
   - The checkbox state is shown as `data-ai-state="checked"` or `"unchecked"`.
   - If the user wants all sources, you can leave them all unchecked (all sources contribute by default).
4. Click **focus-submit** ("Create topic") to save.

## How classification works

- Articles are classified using zero-shot classification (no training needed)
- The focus name is used as the classification label
- Each article gets a confidence score (0.0–1.0) for each focus
- Articles above the minimum confidence threshold appear in the focus feed
- Classification happens automatically when articles are fetched/analysed

## Managing focuses

- **View articles** — the focus detail page shows all articles matching the focus, sorted by score
- **Edit** — on the focus detail page, click `focus-edit-btn` (the settings/cog icon) to go to the edit page. The edit page has the same form as the new page but pre-populated. Source checkboxes use IDs like `edit-focus-source-{sourceId}`. Click `edit-focus-submit` to save.
- **Delete** — removes the focus and its article associations, but doesn't delete articles

## Adding sources to an existing focus

If a focus was created without sources and needs them added:
1. Navigate to the focus detail page (e.g., /focuses/{focusId})
2. Click `focus-edit-btn` to open the edit page
3. Scroll down to the "Source selection" section
4. Click each source checkbox (`edit-focus-source-{sourceId}`) to select it
5. Click `edit-focus-submit` to save

## Tips for good focus names

- Use clear, descriptive topic names: "Climate Change" not "CC"
- Be specific when you want narrow coverage: "Machine Learning Research" not just "Technology"
- Broader names capture more articles but with lower average confidence
