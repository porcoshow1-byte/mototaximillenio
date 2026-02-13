import { supabase, isMockMode } from './supabase';
import { triggerN8NWebhook } from './n8n';

export type TicketType = 'ride_issue' | 'payment' | 'feedback' | 'support_request' | 'vehicle_issue' | 'other';
export type TicketStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

export interface TicketComment {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt: number;
    isAdmin: boolean;
}

export interface SupportTicket {
    id: string;
    type: TicketType;
    status: TicketStatus;
    urgency: UrgencyLevel;
    title: string;
    description: string;
    userId: string;
    userName: string;
    userRole: 'driver' | 'passenger';
    createdAt: number;
    updatedAt: number;
    rideId?: string;
    read: boolean;
    comments?: TicketComment[];
    rideDetails?: {
        rideId: string;
        origin: string;
        destination: string;
        date: number;
        price: number;
    };
    attachments?: string[];
}

const TABLE_NAME = 'support_tickets';

// Helpers
const mapToAppTicket = (data: any): SupportTicket => {
    return {
        id: data.id,
        type: data.type,
        status: data.status,
        urgency: data.urgency,
        title: data.title,
        description: data.description,
        userId: data.user_id,
        userName: data.user_name,
        userRole: data.user_role,
        rideId: data.ride_id,
        read: data.read,
        comments: data.comments, // JSONB
        rideDetails: data.ride_details, // JSONB
        attachments: data.attachments, // Array
        createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
        updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
    };
};

const mapToDbTicket = (data: Partial<SupportTicket>): any => {
    const mapped: any = { ...data };

    if (data.userId) mapped.user_id = data.userId;
    if (data.userName) mapped.user_name = data.userName;
    if (data.userRole) mapped.user_role = data.userRole;
    if (data.rideId) mapped.ride_id = data.rideId;
    if (data.rideDetails) mapped.ride_details = data.rideDetails;
    // status, urgency, title, description, read, comments, attachments match

    delete mapped.userId;
    delete mapped.userName;
    delete mapped.userRole;
    delete mapped.rideId;
    delete mapped.rideDetails;

    // Supabase handles generated cols
    delete mapped.id;
    delete mapped.createdAt;
    delete mapped.updatedAt;

    return mapped;
};

// MOCK DATA STORAGE
const getMockTickets = (): SupportTicket[] => {
    const stored = localStorage.getItem('motoja_support_tickets');
    return stored ? JSON.parse(stored) : [];
};

const saveMockTickets = (tickets: SupportTicket[]) => {
    localStorage.setItem('motoja_support_tickets', JSON.stringify(tickets));
};

export const createSupportTicket = async (ticketData: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'read' | 'status'>) => {
    if (isMockMode || !supabase) {
        const newTicket: SupportTicket = {
            ...ticketData,
            id: `ticket_${Date.now()}`,
            status: 'pending',
            read: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        const tickets = getMockTickets();
        tickets.push(newTicket);
        saveMockTickets(tickets);
        triggerN8NWebhook('support_ticket_created', newTicket);
        return newTicket;
    }

    const dbData = mapToDbTicket({
        ...ticketData,
        status: 'pending',
        read: false
    });

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert(dbData)
        .select()
        .single();

    if (error) {
        console.error("Error creating ticket:", error);
        throw error;
    }

    const createdTicket = mapToAppTicket(data);
    triggerN8NWebhook('support_ticket_created', createdTicket);
    return createdTicket;
};

export const subscribeToTickets = (callback: (tickets: SupportTicket[]) => void) => {
    if (isMockMode || !supabase) {
        callback(getMockTickets());
        return () => { };
    }

    const fetchAll = () => {
        supabase
            .from(TABLE_NAME)
            .select('*')
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                if (data) callback(data.map(mapToAppTicket));
            });
    };

    fetchAll();

    const channel = supabase
        .channel('support_tickets_list')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: TABLE_NAME },
            () => fetchAll()
        )
        .subscribe();

    return () => channel.unsubscribe();
};

export const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    if (isMockMode || !supabase) {
        const tickets = getMockTickets();
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
            ticket.status = status;
            ticket.updatedAt = Date.now();
            ticket.read = true;
            saveMockTickets(tickets);
        }
        return;
    }

    await supabase
        .from(TABLE_NAME)
        .update({ status, read: true })
        .eq('id', ticketId);
};

export const addTicketComment = async (ticketId: string, comment: Omit<TicketComment, 'id' | 'createdAt'>) => {
    const newComment = {
        ...comment,
        id: `c_${Date.now()}`,
        createdAt: Date.now()
    };

    if (isMockMode || !supabase) {
        const tickets = getMockTickets();
        const ticket = tickets.find(t => t.id === ticketId);
        if (ticket) {
            if (!ticket.comments) ticket.comments = [];
            ticket.comments.push(newComment);
            saveMockTickets(tickets);
        }
        return;
    }

    // 1. Get current comments
    const { data: ticket } = await supabase
        .from(TABLE_NAME)
        .select('comments')
        .eq('id', ticketId)
        .single();

    const currentComments: any[] = ticket?.comments || [];
    const updatedComments = [...currentComments, newComment];

    // 2. Update
    await supabase
        .from(TABLE_NAME)
        .update({ comments: updatedComments })
        .eq('id', ticketId);
};

export const getDriverTickets = async (driverId: string): Promise<SupportTicket[]> => {
    if (isMockMode || !supabase) {
        // Return some mock tickets mixed with user's own
        const tickets = getMockTickets();
        // Mock: Filter by userId or just return some for demo
        return tickets.length > 0 ? tickets : [
            {
                id: 't_mock_1',
                type: 'vehicle_issue',
                status: 'resolved',
                urgency: 'medium',
                title: 'Problema na vistoria',
                description: 'Minha foto não foi aceita.',
                userId: driverId,
                userName: 'Motorista',
                userRole: 'driver',
                createdAt: Date.now() - 86400000,
                updatedAt: Date.now(),
                read: true
            },
            {
                id: 't_mock_2',
                type: 'ride_issue',
                status: 'in_progress',
                urgency: 'high',
                title: 'Passageiro não pagou',
                description: 'Corrida #1234 finalizada sem pagamento.',
                userId: driverId,
                userName: 'Motorista',
                userRole: 'driver',
                createdAt: Date.now() - 172800000,
                updatedAt: Date.now(),
                read: false
            }
        ];
    }

    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .or(`user_id.eq.${driverId}, ride_details->>driverId.eq.${driverId}`) // Fetch created by me OR involving me
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching driver tickets:', error);
        return [];
    }

    return data.map(mapToAppTicket);
};
