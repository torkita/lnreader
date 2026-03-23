import { fetchApi, fetchText } from '@libs/fetch';
import { Plugin } from '@/types/plugin';
import { load as parseHTML } from 'cheerio';
import { defaultCover } from '@libs/defaultCover';
import { NovelStatus } from '@libs/novelStatus';

class NovelHi implements Plugin.PluginBase {
  id = 'novelhi';
  name = 'NovelHi';
  icon = 'https://novelhi.com/favicon.ico';
  site = 'https://novelhi.com';
  version = '1.0.0';

  async popularNovels(pageNo: number): Promise<Plugin.NovelItem[]> {
    const params = new URLSearchParams();
    params.append('pageNum', pageNo.toString());
    params.append('pageSize', '20');
    params.append('order', 'views');

    const jsonUrl = `${this.site}/api/novel/search?${params.toString()}`;
    const response = await fetchApi(jsonUrl);
    const json: any = await response.json();

    const novels: Plugin.NovelItem[] = [];
    json.data?.list?.forEach((item: any) => {
      novels.push({
        name: item.novelName,
        path: `/s/${item.novelId}`, 
        cover: item.coverUrl || defaultCover,
      });
    });

    return novels;
  }

  async parseNovel(novelPath: string): Promise<Plugin.SourceNovel> {
    const body = await fetchText(this.site + novelPath);
    const $ = parseHTML(body);

    // FIX: Convert <br> tags to actual new lines in summary
    const rawSummary = $('.detail-intro').html() || '';
    const cleanSummary = rawSummary
      .replace(/<br\s*\/?>/gi, '\n') // Replaces <br>, <br/>, etc. with \n
      .replace(/<[^>]+>/g, '')      // Removes any other leftover HTML tags
      .trim();

    const novel: Plugin.SourceNovel = {
      path: novelPath,
      name: $('.detail-info h1').text().trim(),
      cover: $('.detail-pic img').attr('src') || defaultCover,
      author: $('.detail-info .author').text().replace('Author：', '').trim(),
      summary: cleanSummary,
      status: body.includes('Completed') ? NovelStatus.Completed : NovelStatus.Ongoing,
    };

    const chapters: Plugin.ChapterItem[] = [];
    $('.chapter-list li a').each((i, el) => {
      const name = $(el).text().trim();
      const path = $(el).attr('href');

      if (name && path) {
        chapters.push({
          name: name,
          path: path.replace(this.site, ''), 
          releaseTime: '',
          chapterNumber: i + 1,
        });
      }
    });

    novel.chapters = chapters;
    return novel;
  }

  async parseChapter(chapterPath: string): Promise<string> {
    const body = await fetchText(this.site + chapterPath);
    const $ = parseHTML(body);
    
    $('.show-content script, .show-content style, .show-content .ads, .show-content .recommend').remove();
    const chapterText = $('.show-content').html();
    
    return chapterText || 'Content not found. Try opening in WebView.';
  }

  async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
    const params = new URLSearchParams();
    params.append('keyword', searchTerm);
    params.append('pageNum', pageNo.toString());

    const response = await fetchApi(`${this.site}/api/novel/search?${params.toString()}`);
    const json: any = await response.json();

    const novels: Plugin.NovelItem[] = [];
    json.data?.list?.forEach((item: any) => {
      novels.push({
        name: item.novelName,
        path: `/s/${item.novelId}`,
        cover: item.coverUrl || defaultCover,
      });
    });

    return novels;
  }

  resolveUrl = (path: string) => (path.startsWith('http') ? path : this.site + path);
}

export default new NovelHi();
