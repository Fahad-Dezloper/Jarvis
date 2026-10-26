const CalculatorDisplay = ({ expression, displayValue, caption }) => {
  const visibleValue = expression || displayValue;

  return (
    <div className="flex h-24 w-full flex-col items-end justify-end overflow-hidden mb-2 pr-2">
      {caption ? (
        <span
          data-testid="calc-caption"
          className="shrink-0 text-sm text-white/50 tabular-nums mb-1"
        >
          {caption}
        </span>
      ) : null}
      <span className="shrink-0 whitespace-nowrap text-[4rem] text-white font-light tabular-nums leading-none tracking-tight">
        {visibleValue}
      </span>
    </div>
  );
};

export default CalculatorDisplay;
