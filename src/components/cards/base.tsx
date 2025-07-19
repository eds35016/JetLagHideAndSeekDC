import { useStore } from "@nanostores/react";
import { LockIcon, UnlockIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { VscChevronDown, VscShare, VscTrash } from "react-icons/vsc";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
} from "@/components/ui/sidebar-l";
import { isLoading, questions } from "@/lib/context";
import { cn } from "@/lib/utils";

export const QuestionCard = ({
    children,
    questionKey,
    className,
    label,
    sub,
    collapsed,
    locked,
    setLocked,
    setCollapsed,
}: {
    children: React.ReactNode;
    questionKey: number;
    className?: string;
    label?: string;
    sub?: string;
    collapsed?: boolean;
    locked?: boolean;
    setLocked?: (locked: boolean) => void;
    setCollapsed?: (collapsed: boolean) => void;
}) => {
    const [isCollapsed, setIsCollapsed] = useState(collapsed ?? false);
    const $questions = useStore(questions);
    const $isLoading = useStore(isLoading);

    const toggleCollapse = () => {
        if (setCollapsed) {
            setCollapsed(!isCollapsed);
        }
        setIsCollapsed((prevState) => !prevState);
    };

    return (
        <>
            <SidebarGroup className={className}>
                <div className="relative">
                    <button
                        onClick={toggleCollapse}
                        className={cn(
                            "absolute top-2 left-2 text-white border rounded-md transition-all duration-500",
                            isCollapsed && "-rotate-90",
                        )}
                        title={isCollapsed ? "Expand section" : "Collapse section"}
                    >
                        <VscChevronDown />
                    </button>
                    <SidebarGroupLabel
                        className="ml-8 mr-8 cursor-pointer"
                        onClick={toggleCollapse}
                    >
                        {label} {sub && `(${sub})`}
                    </SidebarGroupLabel>
                    <SidebarGroupContent
                        className={cn(
                            "overflow-hidden transition-all duration-1000 max-h-[100rem]", // 100rem is arbitrary
                            isCollapsed && "max-h-0",
                        )}
                    >
                        <SidebarMenu>{children}</SidebarMenu>
                        <div className="flex gap-2 pt-2 px-2 justify-center">
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                    if (!navigator || !navigator.clipboard) {
                                        toast.error(
                                            "Clipboard API not supported in your browser",
                                        );
                                        return;
                                    }

                                    const questionData = $questions.find(
                                        (q) => q.key === questionKey,
                                    );

                                    toast.promise(
                                        navigator.clipboard.writeText(
                                            JSON.stringify(questionData, null, 4)
                                        ),
                                        {
                                            pending: "Copying question to clipboard...",
                                            success: "Question copied to clipboard!",
                                            error: "An error occurred while copying",
                                        },
                                        { autoClose: 1000 },
                                    );
                                }}
                            >
                                <VscShare />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={$isLoading}
                                    >
                                        <VscTrash />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            Are you absolutely sure?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This
                                            will permanently delete the
                                            question.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>
                                            Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => {
                                                questions.set([]);
                                            }}
                                        >
                                            Delete All Questions
                                        </AlertDialogAction>
                                        <AlertDialogAction
                                            onClick={() => {
                                                questions.set(
                                                    $questions.filter(
                                                        (q) =>
                                                            q.key !==
                                                            questionKey,
                                                    ),
                                                );
                                            }}
                                            className="mb-2 sm:mb-0"
                                        >
                                            Delete Question
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            {locked !== undefined && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setLocked!(!locked)}
                                    disabled={$isLoading}
                                >
                                    {locked ? <LockIcon /> : <UnlockIcon />}
                                </Button>
                            )}
                        </div>
                    </SidebarGroupContent>
                </div>
            </SidebarGroup>
            <Separator className="h-1" />
        </>
    );
};
