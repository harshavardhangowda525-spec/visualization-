"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "./ui/button";
export function Management({
  kind,
  onSave,
}: {
  kind: string;
  onSave: () => void;
}) {
  const [msg, setMsg] = useState(""),
    [users, setUsers] = useState<any[]>([]),
    [settings, setSettings] = useState<any[]>([]),
    [cats, setCats] = useState<any[]>([]),
    [studios, setStudios] = useState<any[]>([]);
  useEffect(() => {
    if (kind === "team")
      Promise.all([api("/admin/customers"), api("/admin/staff")])
        .then(([a, b]) => setUsers([...a, ...b]))
        .catch((e) => setMsg(e.message));
    if (kind === "settings")
      api("/admin/settings")
        .then(setSettings)
        .catch((e) => setMsg(e.message));
    if (kind === "studio-create")
      Promise.all([api("/categories"), api("/admin/studios")])
        .then(([a, b]) => {
          setCats(a);
          setStudios(b);
        })
        .catch((e) => setMsg(e.message));
  }, [kind]);
  async function submit(
    e: React.FormEvent<HTMLFormElement>,
    fn: (f: FormData) => Promise<any>,
  ) {
    e.preventDefault();
    try {
      await fn(new FormData(e.currentTarget));
      setMsg("Changes saved.");
      onSave();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  return (
    <>
      <p role="status" className={msg ? "notice" : ""}>
        {msg}
      </p>
      {kind === "team" ? (
        <form
          className="editor-form"
          onSubmit={(e) =>
            submit(e, (f) =>
              api("/admin/staff/role", {
                userId: f.get("userId"),
                role: f.get("role"),
                enabled: f.get("enabled") === "on",
                title: f.get("title"),
              }),
            )
          }
        >
          <h2>Manage staff access.</h2>
          <p>
            Staff must first verify their phone through the normal registration
            flow. Role changes revoke their sessions.
          </p>
          <label>
            Verified account
            <select name="userId" required>
              <option value="">Select account</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.phone} · {u.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select name="role">
              <option value="STAFF">Studio staff</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </label>
          <label>
            Job title
            <input
              name="title"
              defaultValue="Studio staff"
              required
              maxLength={100}
            />
          </label>
          <label className="checkbox-label">
            <input name="enabled" type="checkbox" defaultChecked />
            Account enabled
          </label>
          <Button type="submit">Confirm role change</Button>
        </form>
      ) : null}
      {kind === "settings" ? (
        <div className="workspace-cards">
          {settings.map((s) => (
            <form
              className="editor-form"
              key={s.key}
              onSubmit={(e) =>
                submit(e, (f) =>
                  api(
                    "/admin/settings/" + s.key,
                    { json: f.get("json") },
                    "PATCH",
                  ),
                )
              }
            >
              <h3>{s.key}</h3>
              <p>
                Configure business content. Booking policy changes apply to
                future reservations.
              </p>
              <label>
                Configuration
                <textarea
                  name="json"
                  rows={14}
                  defaultValue={JSON.stringify(s.value, null, 2)}
                  required
                />
              </label>
              <Button type="submit">Save {s.key}</Button>
            </form>
          ))}
        </div>
      ) : null}
      {kind === "studio-create" ? (
        <div className="workspace-cards">
          <form
            className="editor-form"
            onSubmit={(e) =>
              submit(e, (f) =>
                api("/admin/studios", {
                  name: f.get("name"),
                  slug: f.get("slug"),
                  categoryId: f.get("category"),
                  description: f.get("description"),
                  location: f.get("location"),
                  capacity: Number(f.get("capacity")),
                  bufferMinutes: Number(f.get("buffer")),
                  equipment: String(f.get("equipment"))
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                  active: false,
                }),
              )
            }
          >
            <h2>Add a studio.</h2>
            <label>
              Name
              <input required name="name" maxLength={120} />
            </label>
            <label>
              URL slug
              <input
                required
                name="slug"
                pattern="[a-z0-9-]{3,80}"
                placeholder="the-daylight"
              />
            </label>
            <label>
              Category
              <select name="category" required>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea name="description" required maxLength={5000} />
            </label>
            <label>
              Location
              <input name="location" required maxLength={200} />
            </label>
            <label>
              Capacity
              <input
                name="capacity"
                required
                type="number"
                min="1"
                max="500"
                defaultValue="10"
              />
            </label>
            <label>
              Buffer minutes
              <input
                name="buffer"
                required
                type="number"
                min="0"
                max="120"
                defaultValue="15"
              />
            </label>
            <label>
              Equipment (comma separated)
              <input name="equipment" />
            </label>
            <p>
              New studios remain inactive until services, images, opening hours
              and details are configured.
            </p>
            <Button type="submit">Create studio</Button>
          </form>
          <form
            className="editor-form"
            onSubmit={(e) =>
              submit(e, (f) =>
                api("/admin/services", {
                  studioId: f.get("studioId"),
                  name: f.get("name"),
                  hourlyPaise: Math.round(Number(f.get("price")) * 100),
                  taxBps: Number(f.get("tax")),
                  minMinutes: Number(f.get("min")),
                  maxMinutes: Number(f.get("max")),
                  stepMinutes: Number(f.get("step")),
                  active: true,
                }),
              )
            }
          >
            <h2>Add a service.</h2>
            <label>
              Studio
              <select name="studioId" required>
                {studios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service name
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Hourly price (₹)
              <input name="price" required type="number" min="1" step="0.01" />
            </label>
            <label>
              Tax basis points
              <input
                name="tax"
                type="number"
                min="0"
                max="10000"
                defaultValue="1800"
                required
              />
            </label>
            <label>
              Minimum minutes
              <input
                name="min"
                type="number"
                min="30"
                max="480"
                defaultValue="60"
                required
              />
            </label>
            <label>
              Maximum minutes
              <input
                name="max"
                type="number"
                min="30"
                max="480"
                defaultValue="480"
                required
              />
            </label>
            <label>
              Time increments
              <select name="step">
                <option value="30">30 minutes</option>
                <option value="15">15 minutes</option>
                <option value="60">60 minutes</option>
              </select>
            </label>
            <Button type="submit">Create service</Button>
          </form>
          <form
            className="editor-form"
            onSubmit={(e) =>
              submit(e, (f) =>
                api("/admin/studios/" + f.get("studioId") + "/hours", {
                  weekday: Number(f.get("weekday")),
                  openMinute: Number(f.get("open")),
                  closeMinute: Number(f.get("close")),
                }),
              )
            }
          >
            <h2>Set opening hours.</h2>
            <label>
              Studio
              <select name="studioId" required>
                {studios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Day
              <select name="weekday">
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Opening minute of day (540 = 09:00)
              <input
                type="number"
                min="0"
                max="1439"
                name="open"
                defaultValue="540"
                required
              />
            </label>
            <label>
              Closing minute of day (1260 = 21:00)
              <input
                type="number"
                min="1"
                max="1440"
                name="close"
                defaultValue="1260"
                required
              />
            </label>
            <Button type="submit">Save hours</Button>
          </form>
          <form
            className="editor-form"
            onSubmit={(e) =>
              submit(e, async (f) => {
                const file = f.get("image") as File;
                if (!file?.size) throw new Error("Choose an image");
                const signed = await api("/admin/media/presign", {
                  contentType: file.type,
                  size: file.size,
                });
                const r = await fetch(signed.url, {
                  method: "PUT",
                  headers: { "Content-Type": file.type },
                  body: file,
                });
                if (!r.ok) throw new Error("Upload failed");
                return api("/admin/media/publish", {
                  studioId: f.get("studioId"),
                  key: signed.key,
                  alt: f.get("alt"),
                });
              })
            }
          >
            <h2>Publish studio imagery.</h2>
            <label>
              Studio
              <select name="studioId" required>
                {studios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Image
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                required
              />
            </label>
            <label>
              Accessible description
              <input name="alt" required maxLength={300} />
            </label>
            <p>
              Maximum 10 MB. Images are validated, resized and stripped of
              metadata before publication.
            </p>
            <Button type="submit">Upload & publish</Button>
          </form>
        </div>
      ) : null}
      {kind === "plan-create" ? (
        <form
          className="editor-form"
          onSubmit={(e) =>
            submit(e, (f) =>
              api("/admin/plans", {
                name: String(f.get("name")),
                description: String(f.get("description")),
                pricePaise: Math.round(Number(f.get("price")) * 100),
                days: Number(f.get("days")),
                discountBps: Math.round(Number(f.get("discount")) * 100),
                creditMinutes: Number(f.get("credits")),
                maxBookings: Number(f.get("limit")),
                benefits: String(f.get("benefits")).split("\n").filter(Boolean),
                active: false,
              }),
            )
          }
        >
          <h2>Create a membership.</h2>
          <label>
            Name
            <input name="name" required maxLength={100} />
          </label>
          <label>
            Description
            <textarea name="description" required maxLength={500} />
          </label>
          <label>
            Prepaid price (₹)
            <input name="price" type="number" min="1" step="0.01" required />
          </label>
          <label>
            Validity days
            <input
              name="days"
              type="number"
              min="1"
              max="730"
              defaultValue={30}
              required
            />
          </label>
          <label>
            Booking discount %
            <input
              name="discount"
              type="number"
              min="0"
              max="100"
              defaultValue={10}
              required
            />
          </label>
          <label>
            Included minutes
            <input
              name="credits"
              type="number"
              min="0"
              max="10000"
              defaultValue={0}
              required
            />
          </label>
          <label>
            Eligible booking limit
            <input
              name="limit"
              type="number"
              min="1"
              max="1000"
              defaultValue={6}
              required
            />
          </label>
          <label>
            Benefits, one per line
            <textarea name="benefits" required />
          </label>
          <p>
            New plans start inactive. Review and activate them under Membership
            plans.
          </p>
          <Button type="submit">Create plan</Button>
        </form>
      ) : null}
      {kind === "category-create" ? (
        <form
          className="editor-form"
          onSubmit={(e) =>
            submit(e, (f) =>
              api("/admin/categories", {
                name: String(f.get("name")),
                slug: String(f.get("slug")),
                description: String(f.get("description")),
                image: String(f.get("image")),
              }),
            )
          }
        >
          <h2>Create a service category.</h2>
          <label>
            Name
            <input name="name" required maxLength={80} />
          </label>
          <label>
            URL slug
            <input name="slug" required pattern="[a-z0-9-]{3,80}" />
          </label>
          <label>
            Description
            <textarea name="description" required maxLength={500} />
          </label>
          <label>
            Approved public image URL
            <input
              name="image"
              required
              placeholder="Your published studio image URL"
            />
          </label>
          <p>
            Use a published image on your configured media CDN, or an existing
            image path. Add studios in this category after saving.
          </p>
          <Button type="submit">Create category</Button>
        </form>
      ) : null}
    </>
  );
}
