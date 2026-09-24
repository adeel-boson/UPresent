import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("h-14 w-full rounded-lg ring-1 ring-foreground/10", className)} />
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">UPresent Design System</h1>
        <p className="text-sm text-muted-foreground">
          Internal reference for tokens and core components. Not linked from product navigation —
          see <code className="rounded bg-muted px-1 py-0.5 text-xs">docs/design-system.md</code>{" "}
          for the full write-up.
        </p>
      </header>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Swatch name="background" className="bg-background" />
          <Swatch name="foreground" className="bg-foreground" />
          <Swatch name="primary (accent)" className="bg-primary" />
          <Swatch name="secondary" className="bg-secondary" />
          <Swatch name="muted" className="bg-muted" />
          <Swatch name="accent" className="bg-accent" />
          <Swatch name="destructive" className="bg-destructive" />
          <Swatch name="card" className="bg-card" />
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-3">
          <p className="font-heading text-2xl font-semibold">Heading 2xl — Geist Sans</p>
          <p className="font-heading text-lg font-medium">Heading lg — section titles</p>
          <p className="text-base">Body base — default paragraph text</p>
          <p className="text-sm text-muted-foreground">Body sm muted — helper and secondary text</p>
          <p className="font-mono text-sm">Mono — Geist Mono, for codes</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="lg" className="h-11">
            Phone tap target (44px)
          </Button>
        </div>
      </Section>

      <Section title="Form fields">
        <Card>
          <CardHeader>
            <CardTitle>Example form</CardTitle>
            <CardDescription>
              Single-column layout, labels above fields, inline validation — per NN/g form-usability
              guidance.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sg-name">Full name</Label>
              <Input id="sg-name" placeholder="Ada Lovelace" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sg-role">Role</Label>
              <Select>
                <SelectTrigger id="sg-role" className="w-full">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="org-admin">Org-admin</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sg-notes">Notes</Label>
              <Textarea id="sg-notes" placeholder="Optional" />
            </div>
            <Alert variant="destructive">
              <AlertTitle>That email is already registered</AlertTitle>
              <AlertDescription>
                Try signing in instead, or use a different email address.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="justify-end">
            <Button>Submit</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Pending</Badge>
          <Badge variant="destructive">Rejected</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </Section>
    </div>
  );
}
