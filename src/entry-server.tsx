import { renderToString } from "react-dom/server";
import Home from "./Home";
import Toolbox from "./Toolbox";
import { profile, publicEvidence, tracks } from "./data/profile";

export function render(page: "home" | "tools") {
  return renderToString(page === "home" ? <Home /> : <Toolbox />);
}

export function structuredData(page: "home" | "tools") {
  const personId = `${profile.url}#person`;
  // Google keys the entity on `name`; the Chinese name people actually search
  // for is primary, with the English, artist and romanized forms as aliases.
  const person = {
    "@type": "Person",
    "@id": personId,
    name: profile.chineseName,
    alternateName: [
      profile.name,
      profile.artistName,
      profile.romanizedName,
      `${profile.chineseName} ${profile.name}`,
      `${profile.name} ${profile.chineseName}`,
    ],
    givenName: "泰元",
    familyName: "賴",
    additionalName: "Leonard",
    url: profile.url,
    mainEntityOfPage: { "@id": `${profile.url}#profile` },
    image: `${profile.url}images/leonard-it-matters-2025.jpg`,
    description: profile.description,
    jobTitle: profile.jobTitle,
    hasOccupation: { "@type": "Occupation", name: profile.jobTitle },
    nationality: { "@type": "Country", name: "台灣" },
    address: { "@type": "PostalAddress", addressCountry: "TW" },
    knowsLanguage: ["zh-Hant", "en"],
    knowsAbout: [
      "Java",
      "Spring Boot",
      "RESTful API",
      "AWS",
      "AI 應用",
      "AIEC 大型語言模型送測",
      "大型語言模型調校與評測",
      "音樂創作",
    ],
    alumniOf: { "@type": "CollegeOrUniversity", name: "輔仁大學" },
    worksFor: {
      "@type": "Organization",
      name: "eGroupAI",
      url: profile.links.company,
    },
    sameAs: [
      profile.links.github,
      profile.links.linkedin,
      profile.links.spotify,
      profile.links.apple,
      profile.links.youtube,
      profile.links.youtubeMusic,
      profile.links.amazon,
      profile.links.credly,
    ],
    subjectOf: publicEvidence.map((source) => ({
      "@type": "CreativeWork",
      name: source.name,
      url: source.url,
      datePublished: source.datePublished,
      publisher: { "@type": "Organization", name: source.publisher },
    })),
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      name: "AWS Certified Solutions Architect – Associate",
      credentialCategory: "Professional certification",
      url: profile.links.credly,
      recognizedBy: {
        "@type": "Organization",
        name: "Amazon Web Services Training and Certification",
      },
    },
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@type": "WebSite",
        "@id": `${profile.url}#website`,
        url: profile.url,
        name: `${profile.chineseName} ${profile.name}`,
        alternateName: [
          `${profile.chineseName}的創作基地`,
          `${profile.chineseName}個人網站`,
          `${profile.name} ${profile.chineseName}`,
        ],
        description: profile.description,
        inLanguage: "zh-Hant",
        author: { "@id": personId },
        publisher: { "@id": personId },
      },
      page === "home"
        ? {
            "@type": "ProfilePage",
            "@id": `${profile.url}#profile`,
            url: profile.url,
            name: profile.title,
            description: profile.description,
            abstract: profile.story,
            datePublished: profile.publishedAt,
            dateModified: profile.updatedAt,
            inLanguage: "zh-Hant",
            mainEntity: { "@id": personId },
            author: { "@id": personId },
            citation: [
              ...publicEvidence.map((source) => source.url),
              profile.links.credly,
            ],
            hasPart: [
              {
                "@type": "WebPageElement",
                "@id": `${profile.url}#values-title`,
                name: "立足台灣，讓每個故事都有自己的聲音。",
              },
              {
                "@type": "WebPageElement",
                "@id": `${profile.url}#evaluation-title`,
                name: "AIEC 大型語言模型送測經驗",
                description:
                  "參與送測準備與流程協調、模型調校與測試、結果分析、報告整理與檢視。",
              },
              ...tracks.map((track) => {
                const [minutes, seconds] = track.duration.split(":");
                return {
                  "@type": "MusicRecording",
                  name: track.title,
                  url: `https://open.spotify.com/track/${track.id}`,
                  image: track.image,
                  duration: `PT${minutes}M${seconds}S`,
                  byArtist: { "@id": personId },
                  creditText: track.artist,
                };
              }),
            ],
            isPartOf: { "@id": `${profile.url}#website` },
          }
        : {
            "@type": "CollectionPage",
            "@id": `${profile.url}tools/#collection`,
            url: `${profile.url}tools/`,
            name: `Leonard 的工具小舖｜${profile.chineseName}的好工具收藏`,
            description: `${profile.chineseName}（${profile.name}）分享親自使用的開源與原始碼公開工具、入門資源與版本更新。`,
            inLanguage: "zh-Hant",
            author: { "@id": personId },
            isPartOf: { "@id": `${profile.url}#website` },
            breadcrumb: { "@id": `${profile.url}tools/#breadcrumb` },
          },
      ...(page === "tools"
        ? [
            {
              "@type": "BreadcrumbList",
              "@id": `${profile.url}tools/#breadcrumb`,
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: `${profile.chineseName} ${profile.name}`,
                  item: profile.url,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "工具小舖",
                  item: `${profile.url}tools/`,
                },
              ],
            },
          ]
        : []),
    ],
  };
}
