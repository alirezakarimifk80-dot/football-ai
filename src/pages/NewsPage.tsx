import React, { useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { NewsArticle } from '../types/football';
import { useLanguage } from '../i18n/LanguageContext';
import { SafeImage } from '../components/ui/SafeImage';

interface NewsPageProps {
  news: NewsArticle[];
}

export const NewsPage: React.FC<NewsPageProps> = ({ news }) => {
  const { t, lang, localize } = useLanguage();
  const [category, setCategory] = useState<'all' | NewsArticle['category']>('all');
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  const categories: ('all' | NewsArticle['category'])[] = [
    'all',
    'tactics',
    'match-report',
    'analytics',
    'transfers',
  ];

  const filtered =
    category === 'all' ? news : news.filter((item) => item.category === category);

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full min-w-0">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">{t.newsPage.title}</h1>
        <p className="text-xs sm:text-sm text-slate-400">{t.newsPage.subtitle}</p>
      </div>

      {/* Filter Bar */}
      <div className="w-full max-w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 border transition-colors ${
              category === cat
                ? 'bg-[#22FF66] text-[#090B0E] border-[#22FF66] font-semibold'
                : 'bg-[#12161B] text-slate-400 border-white/[0.07] hover:text-white'
            }`}
          >
            {t.newsPage[cat]}
          </button>
        ))}
      </div>

      {/* Article Reader Panel */}
      {activeArticle && (
        <article className="rounded-2xl bg-[#12161B] border border-[#22FF66]/30 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr]">
            <div className="aspect-[4/3] lg:aspect-auto lg:h-full bg-[#090B0E]">
              <SafeImage
                src={activeArticle.imageUrl}
                alt={localize(activeArticle.title)}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-4 sm:p-6 space-y-4 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 min-w-0">
                  <span className="text-[#22FF66] font-semibold">
                    {t.newsPage[activeArticle.category]}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeArticle.publishedAt}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{localize(activeArticle.author)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveArticle(null)}
                  aria-label={t.common.close}
                  className="min-h-[40px] min-w-[40px] -mt-2 -me-2 flex items-center justify-center rounded-lg text-slate-400 hover:text-white shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h2 className="text-lg sm:text-2xl font-bold text-white break-words">
                {localize(activeArticle.title)}
              </h2>
              <p className="text-sm text-slate-200 leading-relaxed break-words">
                {localize(activeArticle.body)}
              </p>
              {activeArticle.sourceUrl && activeArticle.sourceUrl.startsWith('https://') && (
                <div className="pt-2">
                  <a
                    href={activeArticle.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg bg-[#22FF66]/10 border border-[#22FF66]/30 text-xs font-semibold text-[#22FF66] hover:bg-[#22FF66]/20 transition-colors"
                  >
                    <span>{lang === 'fa' ? 'مطالعه خبر کامل در منبع' : 'Read Full Story at Source'}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </article>
      )}

      {/* Articles Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl bg-[#12161B] border border-white/[0.07] p-8 text-center text-sm text-slate-400">
          {t.common.noResults}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <article
              key={item.id}
              onClick={() => setActiveArticle(item)}
              className="group cursor-pointer rounded-xl bg-[#12161B] border border-white/[0.07] overflow-hidden flex flex-col hover:border-white/[0.16] transition-colors"
            >
              <div className="aspect-[4/3] w-full bg-[#090B0E] overflow-hidden">
                <SafeImage
                  src={item.imageUrl}
                  alt={localize(item.title)}
                  fallbackLabel={localize(item.title)}
                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="text-[#22FF66] font-medium">{t.newsPage[item.category]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.publishedAt}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {item.readTimeMin} {t.common.minRead}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white group-hover:text-[#22FF66] transition-colors">
                    {localize(item.title)}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                    {localize(item.summary)}
                  </p>
                </div>
                <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs">
                  <span className="text-slate-500">{localize(item.author)}</span>
                  <span className="text-[#22FF66] font-medium">{t.common.readMore}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
