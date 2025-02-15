import { ChangeEvent, useId, useState } from "react";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  children?: React.ReactNode;
  inputRef?: React.MutableRefObject<HTMLInputElement>;
  rounded?: "small" | "large";
}

export default function ButtonFileInput({
  children,
  inputRef,
  rounded = "large",
  onChange,
  ...rest
}: Props) {
  const id = useId();

  const [file, setFile] = useState<File>();

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (onChange) onChange(e);

    const file = e.target.files?.[0];
    if (file) setFile(file);
  }

  const roundClass =
    rounded === "small"
      ? "rounded-lg"
      : rounded === "large"
      ? "rounded-xl"
      : "rounded-full";

  return (
    <div className="flex flex-col">
      <label
        htmlFor={id}
        className={`relative flex cursor-pointer select-none items-center justify-center px-5 py-1.5 font-bold transition hover:bg-primaryContainer hover:text-onPrimaryContainer ${roundClass}`}
      >
        {children ?? file?.name}
      </label>

      <div>
        <input
          ref={inputRef}
          id={id}
          type="file"
          className="hidden"
          onChange={handleChange}
          {...rest}
        />
      </div>
    </div>
  );
}
