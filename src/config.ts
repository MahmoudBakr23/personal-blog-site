import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://bakrblog.netlify.app/", // replace this with your deployed domain
  author: "Mahmoud Bakr",
  profile: "https://www.linkedin.com/in/m-bakr/",
  desc: "A place where Bakr's tech articles live at.",
  title: "BakrBlog",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 3,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
};

export const LOCALE = {
  lang: "en", // html lang code. Set this empty and default will be "en"
  langTag: ["en-EN"], // BCP 47 Language Tags. Set this empty [] to use the environment default
} as const;

export const LOGO_IMAGE = {
  enable: true,
  svg: false,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/MahmoudBakr23",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/m-bakr/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:mbakr6821@gmail.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: false,
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/201146467077",
    linkTitle: `${SITE.title} on WhatsApp`,
    active: false,
  },
];
