import type { Resume } from "lib/redux/types";

/** A small, realistic resume used across the analysis tests. */
export const RESUME: Resume = {
  profile: {
    name: "Priya Nair",
    email: "priya.nair@example.com",
    phone: "0412 345 678",
    url: "linkedin.com/in/priya-nair",
    summary: "Data analyst with 8 years of experience in retail and logistics.",
    location: "Melbourne, VIC",
  },
  workExperiences: [
    {
      company: "Brightwave Retail",
      jobTitle: "Senior Data Analyst",
      date: "Feb 2021 - Present",
      descriptions: ["Built a demand forecasting model that cut stock-outs by 18%", "Led a team of 4 analysts"],
    },
    {
      company: "Coastline Logistics",
      jobTitle: "Data Analyst",
      date: "Jan 2017 - Jan 2021",
      descriptions: ["Automated daily route reporting in Python, saving 12 hours a week", "Designed Power BI dashboards used by 60 depot managers"],
    },
  ],
  educations: [{ school: "University of Melbourne", degree: "Master of Data Science", date: "2015 - 2016", gpa: "", descriptions: [] }],
  projects: [{ project: "Open Transport Tracker", date: "2022", descriptions: ["Public dashboard of tram delays built with SQL and Tableau"] }],
  skills: {
    featuredSkills: [
      { skill: "Python", rating: 5 },
      { skill: "SQL", rating: 5 },
      { skill: "Power BI", rating: 4 },
    ],
    descriptions: ["Tableau, Forecasting"],
  },
  custom: { descriptions: ["Microsoft Certified: Data Analyst Associate (2022)"] },
};

export const JOB_DESCRIPTION = `Senior Data Analyst at Northern Lights Energy (Melbourne).
You will build forecasting models in Python and SQL, present insights to executives in Power BI, and mentor junior analysts.
Required: 5+ years analytics experience, Python, SQL, Power BI, stakeholder communication. Nice to have: Snowflake, dbt, Airflow.`;
