import Icon from "./Icon";

export default function Stepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol className="flex items-center" aria-label="Langkah pengisian">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`flex items-center ${i < steps.length - 1 ? "flex-1" : ""}`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                done || active
                  ? "bg-brand-800 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {done ? <Icon name="check" className="size-4" /> : i + 1}
            </span>
            <span
              className={`ml-2 text-sm ${
                active ? "font-medium text-brand-800" : "hidden text-gray-500 sm:inline"
              }`}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span
                className={`mx-3 h-px flex-1 ${done ? "bg-brand-800" : "bg-gray-300"}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
