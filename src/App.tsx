import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title
} from "@mantine/core";
import { Check, Download, Plus, RefreshCw, Settings, Trash2, Upload } from "lucide-react";
import styled from "styled-components";
import { loadData, saveData, downloadJson } from "./db";
import { generateDayOptions } from "./planner";
import type { AppData, Availability, Category, FoodState, Location, Meal } from "./types";

type Tab = "planner" | "inventory" | "history" | "settings";
type InventoryDraft = { name: string; category: Category };

const categories: Category[] = ["protein", "vegetable", "fruit"];
const locations: Location[] = ["fridge", "freezer"];

function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [tab, setTab] = useState<Tab>("planner");
  const [detail, setDetail] = useState(false);
  const [dayMeals, setDayMeals] = useState<Meal[]>([]);
  const [mealOptionSets, setMealOptionSets] = useState<Meal[][]>([]);
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<Location, InventoryDraft>>({
    fridge: { name: "", category: "vegetable" },
    freezer: { name: "", category: "protein" }
  });
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadData().then(d => {
      setData(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (data) saveData(data);
  }, [data]);

  const foodMap = useMemo(() => new Map((data?.foods ?? []).map(f => [f.id, f])), [data]);
  const update = (fn: (d: AppData) => AppData) => setData(d => d ? fn(structuredClone(d)) : d);

  function makeDay() {
    if (!data) return;
    const options = generateDayOptions(data, today, 3);
    setMealOptionSets(options);
    setDayMeals(options.map(slotOptions => slotOptions[0]));
  }

  function markEaten(meal: Meal) {
    if (!data) return;
    const exists = data.history.some(m => m.id === meal.id && m.date === meal.date);
    if (exists) return;
    update(d => ({ ...d, history: [...d.history, { ...meal, eaten: true }] }));
    setDayMeals(meals => meals.map(m => m.id === meal.id ? { ...m, eaten: true } : m));
  }

  function replaceMeal(meal: Meal, replacement: Meal) {
    setDayMeals(meals => meals.map(m => m.id === meal.id ? replacement : m));
  }

  function addInventory(location: Location) {
    if (!data) return;
    const draft = inventoryDrafts[location];
    const name = draft.name.trim();
    if (!name) return;

    update(d => {
      const existingFood = d.foods.find(f => f.name.toLowerCase() === name.toLowerCase());
      const foodId = existingFood?.id ?? uniqueFoodId(name, d.foods.map(f => f.id));
      const foods = existingFood ? d.foods : [...d.foods, { id: foodId, name, category: draft.category }];
      if (d.inventory.some(i => i.foodId === foodId && i.location === location)) return { ...d, foods };
      return { ...d, foods, inventory: [...d.inventory, { id: crypto.randomUUID(), foodId, location }] };
    });
    setInventoryDrafts(d => ({ ...d, [location]: { ...d[location], name: "" } }));
  }

  function removeInventory(id: string) {
    update(d => ({ ...d, inventory: d.inventory.filter(i => i.id !== id) }));
  }

  function changeInventory(id: string, patch: Partial<{ location: Location; state: FoodState; availability: Availability }>) {
    update(d => ({ ...d, inventory: d.inventory.map(i => i.id === id ? { ...i, ...patch } : i) }));
  }

  function renameFood(foodId: string, name: string) {
    update(d => ({ ...d, foods: d.foods.map(f => f.id === foodId ? { ...f, name } : f) }));
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (
          parsed.version === 1 &&
          Array.isArray(parsed.foods) &&
          Array.isArray(parsed.inventory) &&
          Array.isArray(parsed.history)
        ) {
          const normalized = {
            ...parsed,
            history: parsed.history.map((m: any) => ({
              ...m,
              protein: Array.isArray(m.protein) ? m.protein : typeof m.protein === "string" ? [m.protein] : [],
              vegetables: Array.isArray(m.vegetables) ? m.vegetables : typeof m.vegetables === "string" ? [m.vegetables] : [],
              fruit: Array.isArray(m.fruit) ? m.fruit : typeof m.fruit === "string" ? [m.fruit] : []
            }))
          };
          setData(normalized);
        } else {
          alert("That file doesn't look like a Layla Meal Planner backup.");
        }
      } catch {
        alert("Couldn't read that JSON file.");
      }
    };
    reader.readAsText(file);
  }

  if (loading || !data) return <LoadingState>Loading...</LoadingState>;

  return (
    <Page size="lg">
      <HeaderRow>
        <div>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.14em">Layla</Text>
          <Title order={1} size="h2">Meal Planner</Title>
        </div>
        <ActionIcon variant="default" size="lg" aria-label="Settings" onClick={() => setTab("settings")}>
          <Settings size={18} />
        </ActionIcon>
      </HeaderRow>

      <Tabs value={tab} onChange={value => value && setTab(value as Tab)} mb="xl">
        <Tabs.List>
          <Tabs.Tab value="planner">Planner</Tabs.Tab>
          <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
          <Tabs.Tab value="history">History</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {tab === "planner" && (
        <Stack gap="xl">
          <HeroRow>
            <div>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.14em">Today</Text>
              <Title order={2}>{formatDate(today)}</Title>
              <Text c="dimmed" mt={4}>Three simple meals based on what you have and what Layla has eaten recently.</Text>
            </div>
            <Button leftSection={<RefreshCw size={17} />} onClick={makeDay}>Generate today's meals</Button>
          </HeroRow>

          {dayMeals.length === 0 ? (
            <EmptyState>
              <Title order={3}>Ready when you are</Title>
              <Text c="dimmed">Generate breakfast, lunch, and dinner from the current inventory and meal history.</Text>
              <Button mt="md" leftSection={<RefreshCw size={17} />} onClick={makeDay}>Generate today's meals</Button>
            </EmptyState>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              {dayMeals.map((m, index) => (
                <MealCard
                  key={m.id}
                  meal={m}
                  choices={mealOptionSets[index] ?? [m]}
                  foodMap={foodMap}
                  onEaten={() => markEaten(m)}
                  onSelect={r => replaceMeal(m, r)}
                />
              ))}
            </SimpleGrid>
          )}

          {dayMeals.length > 0 && (
            <Paper withBorder radius="md" p="md">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.12em">Recent meals</Text>
              <Text c="dimmed" size="sm" mt={3}>The planner uses this history to avoid repetitive combinations.</Text>
              <Stack gap="xs" mt="md">
                {[...data.history].slice(-5).reverse().map((m: Meal) => (
                  <Group key={m.id} justify="space-between" gap="md">
                    <Text size="sm" c="dimmed">{formatDate(m.date)}</Text>
                    <Text size="sm" fw={600}>{formatMeal(m, foodMap)}</Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

      {tab === "inventory" && (
        <Stack gap="xl">
          <HeroRow>
            <div>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.14em">Current food</Text>
              <Title order={2}>Inventory</Title>
              <Text c="dimmed" mt={4}>Keep it rough. No counting required.</Text>
            </div>
            <SegmentedControl
              value={detail ? "detailed" : "simple"}
              onChange={value => setDetail(value === "detailed")}
              data={[
                { value: "simple", label: "Simple" },
                { value: "detailed", label: "Detailed" }
              ]}
            />
          </HeroRow>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            {locations.map(loc => {
              const items = data.inventory.filter(i => i.location === loc);
              return (
                <Card withBorder radius="md" padding="lg" key={loc}>
                  <Stack gap="md">
                    <Title order={3} size="h4">{loc === "fridge" ? "Fridge" : "Freezer"}</Title>

                    {categories.map(category => {
                      const categoryItems = items.filter(item => foodMap.get(item.foodId)?.category === category);
                      if (categoryItems.length === 0) return null;

                      return (
                        <Stack gap="xs" key={category}>
                          <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.08em">
                            {category === "protein" ? "Protein" : category === "vegetable" ? "Vegetables" : "Fruit"}
                          </Text>
                          {categoryItems.map(item => {
                            const f = foodMap.get(item.foodId)!;
                            return (
                              <InventoryRow key={item.id}>
                                <TextInput value={f.name} onChange={e => renameFood(f.id, e.currentTarget.value)} />
                                {detail && (
                                  <Group gap="xs" wrap="nowrap">
                                    <Select
                                      w={116}
                                      value={item.availability ?? ""}
                                      onChange={value => changeInventory(item.id, { availability: (value || undefined) as Availability | undefined })}
                                      data={[
                                        { value: "", label: "Normal" },
                                        { value: "plenty", label: "Plenty" },
                                        { value: "some", label: "Some" },
                                        { value: "use-soon", label: "Use soon" }
                                      ]}
                                    />
                                    {loc === "freezer" && (
                                      <Select
                                        w={104}
                                        value={item.state ?? ""}
                                        onChange={value => changeInventory(item.id, { state: (value || undefined) as FoodState | undefined })}
                                        data={[
                                          { value: "", label: "State" },
                                          { value: "raw", label: "Raw" },
                                          { value: "cooked", label: "Cooked" }
                                        ]}
                                      />
                                    )}
                                  </Group>
                                )}
                                <ActionIcon variant="subtle" color="gray" aria-label="Remove" onClick={() => removeInventory(item.id)}>
                                  <Trash2 size={16} />
                                </ActionIcon>
                              </InventoryRow>
                            );
                          })}
                        </Stack>
                      );
                    })}

                    {items.length === 0 && <Text c="dimmed" size="sm">Nothing listed.</Text>}

                    <AddInventoryGrid>
                      <TextInput
                        value={inventoryDrafts[loc].name}
                        placeholder={`Add food to ${loc}`}
                        onChange={e => setInventoryDrafts(d => ({ ...d, [loc]: { ...d[loc], name: e.currentTarget.value } }))}
                        onKeyDown={e => {
                          if (e.key === "Enter") addInventory(loc);
                        }}
                      />
                      <Select
                        value={inventoryDrafts[loc].category}
                        onChange={value => value && setInventoryDrafts(d => ({ ...d, [loc]: { ...d[loc], category: value as Category } }))}
                        data={[
                          { value: "protein", label: "Protein" },
                          { value: "vegetable", label: "Vegetable" },
                          { value: "fruit", label: "Fruit" }
                        ]}
                      />
                      <Button leftSection={<Plus size={17} />} onClick={() => addInventory(loc)}>Add</Button>
                    </AddInventoryGrid>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </Stack>
      )}

      {tab === "history" && (
        <Stack gap="md">
          <HeroRow>
            <div>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.14em">Past meals</Text>
              <Title order={2}>History</Title>
              <Text c="dimmed" mt={4}>{data.history.length} meals recorded. We'll import Kaidi's notes here tomorrow.</Text>
            </div>
          </HeroRow>
          <Paper withBorder radius="md">
            {[...data.history].reverse().map(m => (
              <HistoryRow key={m.id}>
                <div>
                  <Text fw={700} size="sm">{shortDate(m.date)}</Text>
                  <Text c="dimmed" size="xs" tt="capitalize">{m.slot}</Text>
                </div>
                <div>
                  <Text size="sm">{formatMeal(m, foodMap)}</Text>
                  {m.notes && <Text size="xs" c="dimmed" mt={2}>{m.notes}</Text>}
                </div>
              </HistoryRow>
            ))}
          </Paper>
        </Stack>
      )}

      {tab === "settings" && (
        <Stack gap="md">
          <HeroRow>
            <div>
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts="0.14em">Data</Text>
              <Title order={2}>Settings</Title>
              <Text c="dimmed" mt={4}>Everything is stored locally in this browser.</Text>
            </div>
          </HeroRow>
          <Card withBorder radius="md" padding="lg" maw={620}>
            <Title order={3} size="h4">Backup & restore</Title>
            <Text c="dimmed" size="sm" mt={4}>Export a JSON backup if you want to move the planner to another browser or computer.</Text>
            <Group mt="md">
              <Button variant="default" leftSection={<Download size={17} />} onClick={() => downloadJson(data)}>Export data</Button>
              <Button variant="default" component="label" leftSection={<Upload size={17} />}>
                Import data
                <HiddenFileInput type="file" accept="application/json" onChange={e => {
                  const f = e.currentTarget.files?.[0];
                  if (f) importData(f);
                }} />
              </Button>
            </Group>
          </Card>
        </Stack>
      )}
    </Page>
  );
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric"
  }).format(new Date(`${dateString}T12:00:00Z`));
}

function shortDate(dateString: string) {
  return new Date(`${dateString}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMeal(m: Meal, map: Map<string, { name: string }>) {
  return [
    ...m.protein.map(id => map.get(id)?.name),
    ...m.vegetables.map(id => map.get(id)?.name),
    ...m.fruit.map(id => map.get(id)?.name)
  ].filter(Boolean).join(" · ");
}

function uniqueFoodId(name: string, existingIds: string[]) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "food";
  let id = base;
  let i = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${i}`;
    i++;
  }
  return id;
}

function MealCard({ meal, choices, foodMap, onEaten, onSelect }: {
  meal: Meal;
  choices: Meal[];
  foodMap: Map<string, { name: string }>;
  onEaten: () => void;
  onSelect: (m: Meal) => void;
}) {
  const recommended = choices[0];

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group justify="space-between">
          <Badge variant="light">{meal.slot}</Badge>
          {meal.eaten && <Badge color="green" variant="light" leftSection={<Check size={12} />}>Eaten</Badge>}
        </Group>
        <Stack gap="xs">
          {choices.map((choice, index) => {
            const selected = comboSignature(choice) === comboSignature(meal);
            const isRecommended = recommended && comboSignature(choice) === comboSignature(recommended);
            return (
              <ChoiceButton
                key={`${choice.id}-${comboSignature(choice)}`}
                type="button"
                $selected={selected}
                onClick={() => onSelect(choice)}
              >
                <ChoiceTopLine>
                  <Group gap={6}>
                    <SelectionDot>{selected ? "●" : "○"}</SelectionDot>
                    <Text size="sm" fw={700}>{choice.protein.map(id => foodMap.get(id)?.name).join(" + ")}</Text>
                  </Group>
                  {isRecommended && <Badge size="xs" variant="light">Recommended</Badge>}
                </ChoiceTopLine>
                <Text size="sm" c="dimmed">{choice.vegetables.map(id => foodMap.get(id)?.name).join(" + ")}</Text>
                <Text size="sm" c="dimmed">{choice.fruit.map(id => foodMap.get(id)?.name).join(" + ")}</Text>
                {index > 0 && <Text size="xs" c="dimmed">Option {index + 1}</Text>}
              </ChoiceButton>
            );
          })}
        </Stack>
        {!meal.eaten && <Button variant="light" leftSection={<Check size={14} />} onClick={onEaten}>Mark eaten</Button>}
      </Stack>
    </Card>
  );
}

function comboSignature(meal: Meal) {
  return [
    ...meal.protein.map(id => `p:${id}`),
    ...meal.vegetables.map(id => `v:${id}`),
    ...meal.fruit.map(id => `f:${id}`)
  ].sort().join("|");
}

const Page = styled(Container)`
  padding-top: 34px;
  padding-bottom: 60px;
`;

const HeaderRow = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
`;

const HeroRow = styled.section`
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;

  @media (max-width: 760px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const EmptyState = styled(Paper).attrs({ withBorder: true, radius: "md", p: "xl" })`
  min-height: 240px;
  display: grid;
  place-items: center;
  align-content: center;
  text-align: center;
`;

const InventoryRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;

  @media (max-width: 760px) {
    grid-template-columns: minmax(0, 1fr) auto;

    > .mantine-Group-root {
      grid-column: 1 / -1;
      grid-row: 2;
      flex-wrap: wrap;
    }
  }
`;

const AddInventoryGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 132px auto;
  gap: 8px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const HistoryRow = styled.div`
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  gap: 16px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--mantine-color-gray-2);

  &:last-child {
    border-bottom: 0;
  }
`;

const ChoiceButton = styled.button<{ $selected: boolean }>`
  width: 100%;
  border: 1px solid ${props => props.$selected ? "var(--mantine-color-blue-4)" : "var(--mantine-color-gray-3)"};
  background: ${props => props.$selected ? "var(--mantine-color-blue-0)" : "var(--mantine-color-white)"};
  color: inherit;
  border-radius: var(--mantine-radius-md);
  padding: 12px;
  text-align: left;
`;

const ChoiceTopLine = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
`;

const SelectionDot = styled.span`
  color: var(--mantine-color-blue-6);
  line-height: 1.4;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const LoadingState = styled.div`
  min-height: 50vh;
  display: grid;
  place-items: center;
  color: var(--mantine-color-dimmed);
`;

export default App;
