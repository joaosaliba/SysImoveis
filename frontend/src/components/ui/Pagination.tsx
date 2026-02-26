import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    total?: number;
    limit?: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, onLimitChange, total, limit }: PaginationProps) {
    if (totalPages <= 1 && !total) return null;

    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 4) {
                pages.push(1, 2, 3, 4, 5, '...', totalPages);
            } else if (currentPage >= totalPages - 3) {
                pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
            }
        }
        return pages;
    };

    const startItem = total && limit ? (currentPage - 1) * limit + 1 : 0;
    const endItem = total && limit ? Math.min(currentPage * limit, total) : 0;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
            {total && limit && (
                <div className="text-sm text-gray-600">
                    Mostrando <span className="font-medium">{startItem}</span> até{' '}
                    <span className="font-medium">{endItem}</span> de{' '}
                    <span className="font-medium">{total}</span> resultados
                </div>
            )}

            <div className="flex items-center gap-2">
                {onLimitChange && (
                    <select
                        value={limit}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={5}>5 / página</option>
                        <option value={10}>10 / página</option>
                        <option value={25}>25 / página</option>
                        <option value={50}>50 / página</option>
                    </select>
                )}

                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-3 md:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                >
                    <ChevronLeft className="w-6 h-6 md:w-5 md:h-5" />
                </button>

                {getPageNumbers().map((page, index) => (
                    typeof page === 'number' ? (
                        <button
                            key={index}
                            onClick={() => onPageChange(page)}
                            className={`
                                w-11 h-11 md:w-8 md:h-8 rounded-lg text-base md:text-sm font-medium transition-colors
                                ${currentPage === page
                                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }
                            `}
                        >
                            {page}
                        </button>
                    ) : (
                        <span key={index} className="text-gray-400 px-1">...</span>
                    )
                ))}

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-3 md:p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
                >
                    <ChevronRight className="w-6 h-6 md:w-5 md:h-5" />
                </button>
            </div>
        </div>
    );
}
