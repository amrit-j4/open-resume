import { Link } from "components/documentation";
import {
  JOB_BOARD_URL,
  ORIGINAL_PROJECT_NAME,
  ORIGINAL_PROJECT_URL,
  SOURCE_CODE_URL,
} from "lib/site-config";

const QAS = [
  {
    question:
      "Q1. What is a resume builder? Why is a resume builder better than a resume template doc?",
    answer: (
      <>
        <p>
          There are two ways to create a resume today. One option is to use a
          resume template, such as an office/google doc, and customize it
          according to your needs. The other option is to use a resume builder,
          an online tool that allows you to input your information and
          automatically generates a resume for you.
        </p>
        <p>
          Using a resume template requires manual formatting work, like copying
          and pasting text sections and adjusting spacing, which can be
          time-consuming and error-prone. It is easy to run into formatting
          issues, such as using different bullet points or font styles after
          copying and pasting. On the other hand, a resume builder like the
          Job4online Resume Builder saves time and prevents formatting mistakes
          by automatically formatting the resume. It also offers the convenience
          of easily changing font types or sizes with a simple click.
        </p>
      </>
    ),
  },
  {
    question: "Q2. What makes the Job4online Resume Builder different?",
    answer: (
      <>
        <p>
          <span className="font-semibold">
            1. It is designed to be ATS-friendly.
          </span>
          <br />
          Rather than offering endless customization, it only offers options
          that keep your resume easy for applicant tracking systems to read. It
          focuses on the core sections, e.g. profile, work experience,
          education, and skills, and uses a top-down single column design, which
          works best for ATS.
        </p>
        <p>
          <span className="font-semibold">2. It is privacy focused.</span>
          <br />
          While other resume builders store everything you type in their
          databases, this builder keeps your resume data on your own device
          while you work. All inputted data is stored in your browser, where
          only you have access to it. A free Job4online account is only needed
          to download the finished resume.
        </p>
      </>
    ),
  },
  {
    question: "Q3. Who built this resume builder?",
    answer: (
      <p>
        This is the resume builder from{" "}
        <Link href={JOB_BOARD_URL}>Job4online</Link>, offered to help job
        seekers create a professional resume. It is based on the open-source{" "}
        <Link href={ORIGINAL_PROJECT_URL}>{ORIGINAL_PROJECT_NAME}</Link>{" "}
        project, created by{" "}
        <Link href="https://github.com/xitanggg">Xitang Zhao</Link> and designed
        by <Link href="https://www.linkedin.com/in/imzhi">Zhigang Wen</Link>,
        and is released under the GNU AGPL-3.0 licence.
      </p>
    ),
  },
  {
    question: "Q4. Where can I find the source code?",
    answer: (
      <p>
        The complete source code of this application is available in our{" "}
        <Link href={SOURCE_CODE_URL}>public repository</Link>. You can also
        browse jobs and employers on the{" "}
        <Link href={JOB_BOARD_URL}>Job4online job board</Link>.
      </p>
    ),
  },
];

export const QuestionsAndAnswers = () => {
  return (
    <section className="mx-auto max-w-3xl divide-y divide-gray-300 lg:mt-4 lg:px-2">
      <h2 className="text-center text-3xl font-bold">Questions & Answers</h2>
      <div className="mt-6 divide-y divide-gray-300">
        {QAS.map(({ question, answer }) => (
          <div key={question} className="py-6">
            <h3 className="font-semibold leading-7">{question}</h3>
            <div className="mt-3 grid gap-2 leading-7 text-gray-600">
              {answer}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
