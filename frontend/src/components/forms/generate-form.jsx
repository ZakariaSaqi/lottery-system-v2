import { CalendarIcon, Loader } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Calendar } from "../ui/calendar";
import { useState } from "react";
import { z } from "zod";
import { toast, Toaster } from "sonner";
import { format } from "date-fns";
import ExcelJS from "exceljs";
import axios from "axios";
const formSchema = z.object({
  date: z.date({
    required_error: "A date is required.",
  }),
  folderType: z.string({
    required_error: "Please select a folder type.",
  }),
  file: z
    .instanceof(FileList)
    .refine((file) => file?.length === 1, "File is required."),
});

export function GenerateForm({ className, ...props }) {
  const [date, setDate] = useState(null);
  const [folderType, setFolderType] = useState("");
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Validate the form data using zod
    const formData = {
      date,
      folderType,
      file,
    };

    try {
      setLoading(true);
      formSchema.parse(formData);
      setErrors({}); // Clear any previous errors

      // Prepare FormData for submission
      const submissionData = new FormData();
      submissionData.append("date", date.toISOString());
      submissionData.append("folderType", folderType);
      submissionData.append("file", file[0]);

      console.log("Form Data:", formData);
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/process-folder`,
        submissionData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      if (response.status === 200) {
        const { data, excelFileName } = response.data;

        // Create Excel file
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Persons");

        // Define columns
        worksheet.columns = [
          { header: "Entrant Name", key: "entrantName", width: 20 },
          {
            header: "Confirmation Number",
            key: "confirmationNumber",
            width: 20,
          },
          { header: "Year of Birth", key: "yearOfBirth", width: 15 },
          { header: "First Name", key: "firstName", width: 15 },
          { header: "Gender", key: "gender", width: 10 },
          { header: "Country", key: "country", width: 20 },
          { header: "Phone Number", key: "phoneNumber", width: 15 },
          { header: "Email", key: "email", width: 25 },
          { header: "Marital Status", key: "status", width: 15 },
          { header: "Number of Children", key: "numberOfChildren", width: 15 },
          { header: "Folder", key: "folder", width: 20 },
        ];

        // Add rows to the worksheet
        data.forEach((person) => {
          worksheet.addRow(person);
        });

        // Generate the Excel file as a blob
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        // Trigger the download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = excelFileName; // Use the filename from the backend
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success("File downloaded successfully!");
      } else {
        toast.error("Error uploading file: " + response.statusText);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Handle validation errors
        const fieldErrors = {};
        error.errors.forEach((err) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
        toast.error("Please fix the errors in the form.");
      } else {
        console.error("Error:", error);
        toast.error("Error: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Toaster position="bottom-right" richColors />
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Upload Folder</CardTitle>
          <CardDescription>
            Enter the folder details and upload the zipped folder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {/* Date Input */}
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        " justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon />
                      {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {errors.date && (
                  <p className="text-sm text-red-500">{errors.date}</p>
                )}
              </div>

              {/* Folder Type Select */}
              <div className="grid gap-2">
                <Label htmlFor="folderType">Folder Type</Label>
                <Select
                  value={folderType}
                  onValueChange={(value) => setFolderType(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select folder type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="celibataire">Célibataire</SelectItem>
                    <SelectItem value="maries">Mariés</SelectItem>
                  </SelectContent>
                </Select>
                {errors.folderType && (
                  <p className="text-sm text-red-500">{errors.folderType}</p>
                )}
              </div>

              {/* File Upload */}
              <div className="grid gap-2">
                <Label htmlFor="file">Upload Zipped Folder</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".zip"
                  onChange={(e) => setFile(e.target.files)}
                />
                {errors.file && (
                  <p className="text-sm text-red-500">{errors.file}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full">
                {loading ? <Loader className="animate-spin" /> : "Generate"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
