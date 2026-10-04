import {
  JOB_BOARD_URL,
  ORIGINAL_PROJECT_NAME,
  ORIGINAL_PROJECT_URL,
  SITE_NAME,
  SOURCE_CODE_URL,
} from "lib/site-config";

export const Footer = () => {
  return (
    <footer className="border-t-2 border-gray-100 px-8 py-6 text-center text-sm text-gray-500">
      <p>
        © {new Date().getFullYear()}{" "}
        <a className="underline underline-offset-2" href={JOB_BOARD_URL}>
          {SITE_NAME}
        </a>
        . Free and open-source software under the AGPL-3.0 licence.
      </p>
      <p className="mt-1">
        Based on{" "}
        <a className="underline underline-offset-2" href={ORIGINAL_PROJECT_URL}>
          {ORIGINAL_PROJECT_NAME}
        </a>{" "}
        by Xitang Zhao. ·{" "}
        <a className="underline underline-offset-2" href={SOURCE_CODE_URL}>
          Source code
        </a>
      </p>
    </footer>
  );
};
