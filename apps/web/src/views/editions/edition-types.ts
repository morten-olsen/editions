type EditionArticle = {
  id: string;
  sourceId: string;
  title: string;
  author: string | null;
  summary: string | null;
  url: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  consumptionTimeSeconds: number | null;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  sourceType: string;
  readAt?: string | null;
  progress: number;
  sourceName: string;
  focusId: string;
  focusName: string;
  position: number;
};

type EditionDetail = {
  id: string;
  editionConfigId: string;
  title: string;
  totalReadingMinutes: number | null;
  articleCount: number;
  currentPosition: number;
  readAt: string | null;
  publishedAt: string;
  articles: EditionArticle[];
};

type FocusSection = {
  focusId: string;
  focusName: string;
  articles: EditionArticle[];
};

const groupByFocus = (articles: EditionArticle[]): FocusSection[] => {
  const sections: FocusSection[] = [];
  const map = new Map<string, FocusSection>();
  for (const article of articles) {
    let section = map.get(article.focusId);
    if (!section) {
      section = { focusId: article.focusId, focusName: article.focusName, articles: [] };
      map.set(article.focusId, section);
      sections.push(section);
    }
    section.articles.push(article);
  }
  return sections;
};

const formatTime = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  return minutes < 1 ? '< 1 min' : `${minutes} min read`;
};

export type { EditionArticle, EditionDetail, FocusSection };
export { groupByFocus, formatTime };
