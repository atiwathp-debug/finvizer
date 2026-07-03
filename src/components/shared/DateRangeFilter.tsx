import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/Input'

export interface DateRange {
  start: string
  end: string
}

interface DateRangeFilterProps {
  value: DateRange
  onChange: (value: DateRange) => void
}

/** Two date inputs for filtering a report by issueDate range — currently used by the Dashboard. */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <FormField label="ตั้งแต่วันที่" htmlFor="date-range-start">
        <Input
          id="date-range-start"
          type="date"
          value={value.start}
          max={value.end}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </FormField>
      <FormField label="ถึงวันที่" htmlFor="date-range-end">
        <Input
          id="date-range-end"
          type="date"
          value={value.end}
          min={value.start}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
        />
      </FormField>
    </div>
  )
}
