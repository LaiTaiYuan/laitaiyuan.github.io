import { renderToString } from "react-dom/server";
import Home from "./Home";
import Toolbox from "./Toolbox";
import { profile } from "./data/profile";

export function render(page: "home" | "tools") {
  return renderToString(page === "home" ? <Home /> : <Toolbox />);
}

export function structuredData(page: "home" | "tools") {
  const personId = `${profile.url}#person`;
  const person = {
    "@type": "Person",
    "@id": personId,
    name: "Leonard Lai 賴泰元",
    alternateName: ["Leonard Lai", "賴泰元", "LeonardLai"],
    url: profile.url,
    image: `${profile.url}images/leonard-it-matters-2025.jpg`,
    description: profile.description,
    jobTitle: "軟體工程師",
    knowsAbout: [
      "Java",
      "Spring Boot",
      "RESTful API",
      "AWS",
      "AI 應用",
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
      profile.links.amazon,
    ],
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
        name: "Leonard Lai 賴泰元",
        inLanguage: "zh-Hant",
        publisher: { "@id": personId },
      },
      page === "home"
        ? {
            "@type": "ProfilePage",
            "@id": `${profile.url}#profile`,
            url: profile.url,
            name: "Leonard Lai 賴泰元｜軟體工程、AI 應用與音樂創作",
            inLanguage: "zh-Hant",
            mainEntity: { "@id": personId },
            isPartOf: { "@id": `${profile.url}#website` },
          }
        : {
            "@type": "CollectionPage",
            "@id": `${profile.url}tools/#collection`,
            url: `${profile.url}tools/`,
            name: "Leonard 的工具小舖",
            inLanguage: "zh-Hant",
            author: { "@id": personId },
            isPartOf: { "@id": `${profile.url}#website` },
          },
    ],
  };
}
