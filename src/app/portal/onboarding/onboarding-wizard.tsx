"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { onboardingSteps, type OnboardingData, type OnboardingField } from "@/lib/onboarding";
import { completeOnboarding, saveOnboardingStep } from "./actions";

type Props = {
  initialData: Partial<OnboardingData>;
  initialStep: number;
};

export function OnboardingWizard({ initialData, initialStep }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, onboardingSteps.length - 1));
  const [values, setValues] = useState<Record<string, unknown>>({ ...initialData });
  const [pending, startTransition] = useTransition();

  const current = onboardingSteps[step];
  const isLast = step === onboardingSteps.length - 1;
  const progress = Math.round(((step + 1) / onboardingSteps.length) * 100);

  const missingRequired = useMemo(
    () => current.fields.filter((f) => f.required && !valueFilled(values[f.name], f.type)),
    [current.fields, values],
  );

  function setField(name: string, value: unknown) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  function next() {
    if (missingRequired.length > 0) {
      toast.error("Please complete the required fields.");
      return;
    }
    startTransition(async () => {
      const res = await saveOnboardingStep(values, Math.min(step + 1, onboardingSteps.length - 1));
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (isLast) {
        const done = await completeOnboarding(values);
        if (done.error) {
          toast.error(done.error);
          return;
        }
        toast.success("Onboarding complete!");
        router.replace("/portal");
        router.refresh();
      } else {
        setStep((s) => s + 1);
      }
    });
  }

  function back() {
    if (step === 0) return;
    startTransition(async () => {
      await saveOnboardingStep(values, step - 1);
      setStep((s) => s - 1);
    });
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {step + 1} of {onboardingSteps.length}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
        <CardTitle>{current.title}</CardTitle>
        <CardDescription>{current.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current.fields.map((field) => (
          <Field key={field.name} field={field} value={values[field.name]} onChange={setField} />
        ))}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0 || pending}>
          Back
        </Button>
        <Button onClick={next} disabled={pending}>
          {pending ? "Saving…" : isLast ? "Finish" : "Continue"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function valueFilled(value: unknown, type: OnboardingField["type"]) {
  if (type === "checkbox") return value === true;
  return String(value ?? "").trim().length > 0;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: OnboardingField;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
}) {
  const id = `field-${field.name}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}
      {field.required ? <span className="text-red-600"> *</span> : null}
    </Label>
  );

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        {label}
        <Textarea
          id={id}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
        {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-2">
        {label}
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(field.name, v)}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(field.name, c === true)} />
        {label}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label}
      <Input
        id={id}
        type={field.type}
        value={String(value ?? "")}
        placeholder={field.placeholder}
        onChange={(e) => onChange(field.name, e.target.value)}
      />
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
