"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Editor from "@monaco-editor/react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Replace with your real backend URL in prod
const BACKEND_URL = "http://localhost:3001";

export default function HomePage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any | null>(null);
  const [sql, setSql] = useState("SELECT * FROM data");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchCourse = () => {
    fetch(`${BACKEND_URL}/api/courses`)
      .then((res) => res.json())
      .then(setCourses)
      .catch((err) => console.error("Failed to fetch courses:", err));
  };

  // Load courses on mount
  useEffect(() => {
    fetchCourse();
  }, []);

  const runQuery = async () => {
    if (!selectedCourse?.id) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/execute/${selectedCourse.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: sql }),
        }
      );
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ error: "Failed to execute query" });
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      {selectedCourse ? (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => setSelectedCourse(null)}
        >
          Back to Course List
        </Button>
      ) : (
        <CreateCourseDialog onSuccess={fetchCourse} />
      )}

      <h1 className="text-2xl font-bold mb-4 mt-5">SQL Course POC</h1>

      {!selectedCourse && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Available Courses</h2>
          <ul className="space-y-2">
            {courses.map((course) => (
              <li key={course.id}>
                <Button onClick={() => setSelectedCourse(course)}>
                  {course.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedCourse && (
        <div>
          <h2 className="text-xl font-semibold mt-4">{selectedCourse.name}</h2>
          <p className="mb-4">{selectedCourse.description}</p>

          <Editor
            height="200px"
            language="sql"
            value={sql}
            onChange={(v) => setSql(v || "")}
            options={{ automaticLayout: true }}
          />

          <Button onClick={runQuery} className="mt-2" disabled={loading}>
            {loading ? "Running..." : "Run Query"}
          </Button>

          <div className="mt-4">
            {result?.error && (
              <div className="text-red-600 font-mono">{result.error}</div>
            )}

            {Array.isArray(result) && result.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      {Object.keys(result[0]).map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1 border-b border-gray-300 text-left font-semibold"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.map((row, rowIndex) => (
                      <tr key={rowIndex} className="even:bg-gray-50">
                        {Object.values(row).map((val: any, colIndex) => (
                          <td
                            key={colIndex}
                            className="px-2 py-1 border-b border-gray-200"
                          >
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {Array.isArray(result) && result.length === 0 && (
              <p className="text-sm text-gray-500">No results returned.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CreateCourseDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    file: null as File | null,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Handle form submission here
    const formDataToSend = new FormData();
    formDataToSend.append("name", formData.name);
    formDataToSend.append("description", formData.description);
    if (formData.file) {
      formDataToSend.append("file", formData.file);
    }

    // Add your API call here
    try {
      const response = await fetch(`${BACKEND_URL}/api/courses`, {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        throw new Error("Failed to create course");
      }

      const result = await response.json();
      onSuccess?.();
      toast.success("Success creating course");
      setFormData({
        description: "",
        file: null,
        name: "",
      });
      // Optionally handle successful response
    } catch (error) {
      toast.error("Failed creating course");

      console.error("Error creating course:", error);
      // Handle error appropriately
    }
    setIsLoading(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="">Create New Course</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
          <DialogDescription>
            Create a new SQL course by filling out the details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Course name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Course description"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">CSV File</Label>
            <Input
              id="file"
              type="file"
              accept=".csv"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  file: e.target.files ? e.target.files[0] : null,
                })
              }
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span>
                <span className="ml-2">Creating...</span>
              </>
            ) : (
              "Create Course"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
