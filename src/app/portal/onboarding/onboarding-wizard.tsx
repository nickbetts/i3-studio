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
import type { OnboardingFlowField, OnboardingFlowStep } from "@/lib/onboarding-flow";
import { completeOnboarding, saveOnboardingStep } from "./actions";

type Props = {
  flowId: string;
  steps: OnboardingFlowStep[];
  initialData: Record<string, unknown>;
  initialStep: number;
};

export function OnboardingWizard({ flowId, steps, initialData, initialStep }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, Math.max(steps.length - 1, 0)));
  const [values, setValues] = useState<Record<string, unknown>>({ ...initialData });
  const [pending, startTransition] = useTransition();

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const progress = steps.length > 0 ? Math.round(((step + 1) / steps.length) * 100) : 0;

  const missingRequired = useMemo(
    () => (current ? current.fields.filter((f) => f.required && !valueFilled(values[f.key], f.type)) : []),
    [current, values],
  );

  function setField(key: string, value: unknown) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function next() {
    if (missingRequired.length > 0) {
      toast.error("Please complete the required fields.");
      return;
    }
    startTransition(async () => {
      const res = await saveOnboardingStep(flowId, values, Math.min(step + 1, Math.max(steps.length - 1, 0)));
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (isLast) {
        const done = await completeOnboarding(flowId, values);
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
      await saveOnboardingStep(flowId, values, step - 1);
      setStep((s) => s - 1);
    });
  }

  if (!current) {
    return (
      <Card className="w-full max-w-2xl">
        <CardContent className="pt-6 text-sm text-muted-foreground">Onboarding isn&apos;t configured yet. Please contact your account manager.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Step {step + 1} of {steps.length}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} />
        <CardTitle>{current.title}</CardTitle>
        <CardDescription>{current.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {current.fields.map((field) => (
          <Field key={field.key} field={field} value={values[field.key]} onChange={setField} />
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

function valueFilled(value: unknown, type: OnboardingFlowField["type"]) {
  if (type === "checkbox") return value === true;
  return String(value ?? "").trim().length > 0;
}

function Field({
  field,
  value,
  onChange,
}: {
  field: OnboardingFlowField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}) {
  const id = `field-${field.key}`;
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
          onChange={(e) => onChange(field.key, e.target.value)}
        />
        {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-2">
        {label}
        <Select value={String(value ?? "")} onValueChange={(v) => onChange(field.key, v)}>
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
        <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(field.key, c === true)} />
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
        onChange={(e) => onChange(field.key, e.target.value)}
      />
      {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
    </div>
  );
}
