// js/pages/series-detail/components.js

function renderInlineThemeSong(song, type) {
    if (!song) return '';
    const mobileTitle = song.title_op_fr_an || song.title_op_jp_an;
    const title_fr = song.title_op_fr_an || '';
    const title_jp = song.title_op_jp_an ? ` [${song.title_op_jp_an}]` : '';
    const author = song.author_op_an ? `<span class="inline-song-artist">Par ${song.author_op_an}</span>` : '';
  
    return `
        <a href="${song.youtube_url_op_an}" target="_blank" rel="noopener noreferrer" class="inline-song-button">
          <i class="fab fa-youtube inline-song-icon"></i>
          <div class="inline-song-info-desktop">
              <span class="inline-song-type">${type}</span>
              <span class="inline-song-title">${title_fr}${title_jp}</span>
              ${author}
          </div>
          <div class="inline-song-info-mobile">
              <span class="inline-song-type">${type}</span>
              <span class="inline-song-title">${mobileTitle}</span>
          </div>
        </a>
      `;
}
  
function generateAnimeHeader(seriesData, options = {}) {
    if (!seriesData.anime || seriesData.anime.length === 0) {
      return generateSeriesHeader(seriesData);
    }
    const animeInfo = seriesData.anime[0];
    const titleHtml = `<h1 class="detail-title">${seriesData.title}</h1>`;
    const tags = animeInfo.tags || seriesData.tags;
    const description = animeInfo.description || seriesData.description;
    const tagsHtml = (Array.isArray(tags) && tags.length > 0) ? `<div class="detail-tags">${tags.map(t => `<span class="detail-tag">${t}</span>`).join("")}</div>` : "";
    const descriptionHtml = description ? `<p class="detail-description">${description.replace(/\n/g, '<br>')}</p>` : '';
  
    const openingsHtml = (animeInfo.op_an || []).map(song => renderInlineThemeSong(song, 'Opening')).join('');
    const endingsHtml = (animeInfo.ed_an || []).map(song => renderInlineThemeSong(song, 'Ending')).join('');
    const themeSongsButtonsHtml = (openingsHtml || endingsHtml) ? `<div class="inline-songs-container">${openingsHtml}${endingsHtml}</div>` : '';
  
    let metaDesktopList = [];
    if (animeInfo.type_an) metaDesktopList.push(`<p><strong>Type :</strong> ${animeInfo.type_an}</p>`);
    if (animeInfo.status_an) metaDesktopList.push(`<p><strong>Statut :</strong> ${animeInfo.status_an}</p>`);
    if (animeInfo.studios_an && animeInfo.studios_an.length > 0) metaDesktopList.push(`<p><strong>Studio(s) :</strong> ${animeInfo.studios_an.join(', ')}</p>`);
    if (animeInfo.date_start_an) metaDesktopList.push(`<p><strong>Début de diffusion :</strong> ${animeInfo.date_start_an}</p>`);
    const metaDesktopHtml = metaDesktopList.join('');
  
    let animeMetaMobileHtml = '';
    if (animeInfo.type_an || animeInfo.status_an) {
      let typePart = animeInfo.type_an ? `<strong>Type :</strong> ${animeInfo.type_an}` : '';
      let statusPart = animeInfo.status_an ? `<strong>Statut :</strong> ${animeInfo.status_an}` : '';
      animeMetaMobileHtml += `<p class="detail-meta detail-meta-flex-line"><span class="detail-meta-flex-prefix">${typePart}</span><span class="detail-meta-flex-suffix">${statusPart}</span></p>`;
    }
    if (animeInfo.studios_an || animeInfo.date_start_an) {
      let studiosPart = animeInfo.studios_an ? `<strong>Studio(s) :</strong> ${animeInfo.studios_an.join(', ')}` : '';
      let datePart = animeInfo.date_start_an ? `<strong>Début :</strong> ${animeInfo.date_start_an}` : '';
      animeMetaMobileHtml += `<p class="detail-meta detail-meta-flex-line"><span class="detail-meta-flex-prefix">${studiosPart}</span><span class="detail-meta-flex-suffix">${datePart}</span></p>`;
    }
  
    const primaryInfoWrapperClasses = options.primaryInfoWrapperClasses || '';
    const additionalMetadataClasses = options.additionalMetadataClasses || '';
  
    return `
      <div class="series-detail-container anime-view">
        <div class="detail-top-layout-wrapper">
          <div class="detail-cover-wrapper">
              <img src="${animeInfo.cover_an || seriesData.cover || '/img/placeholder_preview.png'}" alt="${seriesData.title} Anime Cover" class="detail-cover" loading="lazy" referrerpolicy="no-referrer">
          </div>
          <div class="detail-all-info-column">
            <div class="detail-primary-info-wrapper ${primaryInfoWrapperClasses}">
              ${titleHtml}
              ${tagsHtml}
            </div>
            <div class="anime-additional-metadata ${additionalMetadataClasses}">
              ${metaDesktopHtml}
              ${themeSongsButtonsHtml}
            </div>
          </div>
        </div>
        <div class="anime-secondary-info-mobile">
          ${animeMetaMobileHtml}
          ${themeSongsButtonsHtml}
        </div>
        ${descriptionHtml}
      </div>
    `;
}
  
function generateSeriesHeader(seriesData) {
    const titleHtml = `<h1 class="detail-title">${seriesData.title}</h1>`;
    const tagsHtml = (Array.isArray(seriesData.tags) && seriesData.tags.length > 0) ? `<div class="detail-tags">${seriesData.tags.map(t => `<span class="detail-tag">${t}</span>`).join("")}</div>` : "";
    let authorArtistHtml = '';
    const authorText = seriesData.author ? `<strong>Auteur :</strong> ${seriesData.author}` : '';
    const artistText = seriesData.artist ? `<strong>Dessinateur :</strong> ${seriesData.artist}` : '';
    if (seriesData.author && seriesData.artist) {
      if (seriesData.author === seriesData.artist) authorArtistHtml = `<p class="detail-meta">${authorText}</p>`;
      else authorArtistHtml = `<p class="detail-meta">${authorText} <span class="detail-artist-spacing">${artistText}</span></p>`;
    } else if (seriesData.author) authorArtistHtml = `<p class="detail-meta">${authorText}</p>`;
    else if (seriesData.artist) authorArtistHtml = `<p class="detail-meta">${artistText}</p>`;
  
    let metaDesktopHtml = [];
    if (seriesData.release_year) metaDesktopHtml.push(`<p><strong>Année :</strong> ${seriesData.release_year}</p>`);
    if (seriesData.release_status) metaDesktopHtml.push(`<p><strong>Statut :</strong> ${seriesData.release_status}</p>`);
    if (seriesData.manga_type) metaDesktopHtml.push(`<p><strong>Type :</strong> ${seriesData.manga_type}</p>`);
    if (seriesData.magazine) metaDesktopHtml.push(`<p><strong>Magazine :</strong> ${seriesData.magazine}</p>`);
    if (seriesData.alternative_titles && seriesData.alternative_titles.length > 0) metaDesktopHtml.push(`<p><strong>Titres alternatifs :</strong> ${seriesData.alternative_titles.join(', ')}</p>`);
    const additionalMetadataDesktop = `<div class="detail-additional-metadata">${metaDesktopHtml.join('')}</div>`;
  
    let metaMobileHtml = '';
    if (seriesData.release_year || seriesData.release_status) {
      let yearPart = seriesData.release_year ? `<strong>Année :</strong> ${seriesData.release_year}` : '';
      let statusPart = seriesData.release_status ? `<strong>Statut :</strong> ${seriesData.release_status}` : '';
      metaMobileHtml += `<p class="detail-meta detail-meta-flex-line"><span class="detail-meta-flex-prefix">${yearPart}</span><span class="detail-meta-flex-suffix">${statusPart}</span></p>`;
    }
    if (seriesData.manga_type || seriesData.magazine) {
      let typePart = seriesData.manga_type ? `<strong>Type :</strong> ${seriesData.manga_type}` : '';
      let magazinePart = seriesData.magazine ? `<strong>Magazine :</strong> ${seriesData.magazine}` : '';
      metaMobileHtml += `<p class="detail-meta detail-meta-flex-line"><span class="detail-meta-flex-prefix">${typePart}</span><span class="detail-meta-flex-suffix">${magazinePart}</span></p>`;
    }
    if (seriesData.alternative_titles && seriesData.alternative_titles.length > 0) metaMobileHtml += `<p class="detail-meta"><strong>Titres alt. :</strong> ${seriesData.alternative_titles.join(', ')}</p>`;
  
    const descriptionHtml = seriesData.description ? `<p class="detail-description">${seriesData.description.replace(/\n/g, '<br>')}</p>` : '';
  
    return `
      <div class="series-detail-container">
        <div class="detail-top-layout-wrapper">
          <div class="detail-cover-wrapper">
            <img src="${seriesData.cover || '/img/placeholder_preview.png'}" alt="${seriesData.title} Cover" class="detail-cover" loading="lazy" referrerpolicy="no-referrer">
          </div>
          <div class="detail-all-info-column">
            <div class="detail-primary-info-wrapper">
              ${titleHtml}
              ${tagsHtml}
              ${authorArtistHtml}
            </div>
            <div class="detail-secondary-info-wrapper detail-secondary-desktop">
              ${additionalMetadataDesktop}
            </div>
          </div>
        </div>
        <div class="detail-secondary-info-wrapper detail-secondary-mobile">
          ${metaMobileHtml}
        </div>
        ${descriptionHtml}
      </div>
    `;
}

function generateNavTabs(seriesData, seriesSlug, activeTab = "manga") {
  const hasEpisodes =
    Array.isArray(seriesData.episodes) && seriesData.episodes.length > 0;
  if (!hasEpisodes) return "";

  // Si c'est un LN, on affiche "Light novel" au lieu de "Manga"
  const primaryLabel = seriesData.light_novel ? "Light novel" : "Manga";

  // Sécurise la valeur d'activeTab
  const current = activeTab === "anime" ? "anime" : "manga";

  return `
    <div class="detail-navigation-tabs">
      <a href="/${seriesSlug}"
         class="detail-nav-button ${current === "manga" ? "active" : ""}">
        ${primaryLabel}
      </a>
      <a href="/${seriesSlug}/episodes"
         class="detail-nav-button ${current === "anime" ? "active" : ""}">
        Anime
      </a>
    </div>
  `;
}


export { generateNavTabs, generateAnimeHeader, generateSeriesHeader };