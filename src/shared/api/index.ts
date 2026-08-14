/**
 * What the app imports *through* this barrel. A fetcher only used by one module
 * (`fetchNews`, `fetchSimilarNews`) is imported by module path instead — two
 * names for one function is how you end up mocking the wrong one in a test.
 *
 * `fetchSearch` is the exception: it has no consumer yet (B7's UI is unbuilt),
 * and this is the name the results page will import.
 */
export { fetchMenuItems } from './fetchMenuItems';
export { fetchMenus } from './fetchMenus';
export { fetchFooter } from './fetchFooter';
export { fetchFilms } from './fetchFilms';
export { fetchLatestNews } from './fetchLatestNews';
export type { NewsSummary } from './fetchLatestNews';
export { fetchNewsList } from './fetchNewsList';
export { fetchSearch } from './fetchSearch';
export type { SearchResult, SearchHit, SearchSubtype, FetchSearchParams } from './fetchSearch';
export { cachedFetchVideo } from './fetchVideo';
export { fetchVideoList } from './fetchVideoList';
export type { VideoDownload, VideoShareLinks } from './fetchVideoList';
export { resolveMediaUrl } from './mediaUrl';
