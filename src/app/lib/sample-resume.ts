import type { Resume } from "lib/redux/types";
import { initialSettings, type Settings } from "lib/redux/settingsSlice";
import { deepClone } from "lib/deep-clone";

/**
 * A fictional sample resume that uses every feature of the builder, so people can
 * see what a finished resume looks like and edit it in place:
 * - all profile fields (contact icons, LinkedIn link)
 * - consecutive roles at one employer (the repeated company name is collapsed)
 * - education with GPA, a second entry at the same school, and bullet points
 * - several projects
 * - featured skills with ratings, plus free-text skill lines
 * - the optional custom section
 * All names, employers and contact details are made up.
 */
export const SAMPLE_RESUME: Resume = {
  profile: {
    name: "Alex Morgan",
    summary:
      "Full-stack engineer with 7+ years building reliable web products for logistics and retail teams.",
    email: "alex.morgan@example.com",
    phone: "0400 000 000",
    location: "Sydney, NSW",
    url: "linkedin.com/in/alex-morgan",
  },
  workExperiences: [
    {
      company: "Harbourview Digital",
      jobTitle: "Senior Software Engineer",
      date: "Mar 2022 - Present",
      descriptions: [
        "Lead a team of 5 engineers delivering a customer portal used by 40,000+ monthly active users",
        "Cut page load time by 45% by introducing server-side rendering and an edge cache",
        "Mentor 3 junior developers and run fortnightly code-review workshops",
      ],
    },
    {
      company: "Harbourview Digital",
      jobTitle: "Software Engineer",
      date: "Jan 2020 - Feb 2022",
      descriptions: [
        "Built a scheduling API in Node.js and PostgreSQL handling 2M+ requests per day",
        "Raised automated test coverage from 40% to 85%, reducing production incidents by 30%",
      ],
    },
    {
      company: "Southern Cross Logistics",
      jobTitle: "Junior Developer",
      date: "Feb 2018 - Dec 2019",
      descriptions: [
        "Developed internal tracking dashboards in React that saved the ops team 10 hours a week",
        "Automated nightly reporting with Python scripts, removing a manual spreadsheet process",
      ],
    },
  ],
  educations: [
    {
      school: "Northern Ranges University",
      degree: "Bachelor of Science in Computer Science",
      gpa: "6.2",
      date: "Feb 2014 - Nov 2017",
      descriptions: [
        "Dean's List for 5 semesters; graduated with First Class Honours",
      ],
    },
    {
      school: "Northern Ranges University",
      degree: "Graduate Certificate in Data Analytics",
      gpa: "",
      date: "Feb 2021 - Nov 2021",
      descriptions: [],
    },
  ],
  projects: [
    {
      project: "Community Jobs Dashboard",
      date: "2023",
      descriptions: [
        "Open-source dashboard that maps local job openings; 1,200+ GitHub stars",
      ],
    },
    {
      project: "Timesheet Tracker",
      date: "2021",
      descriptions: [
        "Mobile-friendly timesheet app adopted by 3 small businesses for weekly payroll",
      ],
    },
  ],
  skills: {
    featuredSkills: [
      { skill: "TypeScript", rating: 5 },
      { skill: "React", rating: 5 },
      { skill: "Node.js", rating: 4 },
      { skill: "PostgreSQL", rating: 4 },
      { skill: "AWS", rating: 3 },
      { skill: "Python", rating: 3 },
    ],
    descriptions: [
      "Tech: REST and GraphQL APIs, Docker, CI/CD, Redis, Jest, Playwright, Accessibility (WCAG)",
      "Soft: Mentoring, Stakeholder Communication, Agile Delivery, Problem Solving",
    ],
  },
  custom: {
    descriptions: [
      "AWS Certified Developer - Associate (2023)",
      "Winner, Sydney Hack for Good (2022)",
      "Speaker, Sydney Web Meetup: \"Making Dashboards Accessible\" (2023)",
    ],
  },
};

export const getSampleSettings = (): Settings => {
  const settings = deepClone(initialSettings);
  settings.template = "modern";
  // The sample shows every section, including the optional custom one
  settings.formToShow.custom = true;
  settings.formToHeading.custom = "CERTIFICATIONS & AWARDS";
  return settings;
};

export const getSampleResume = (): Resume => deepClone(SAMPLE_RESUME);
