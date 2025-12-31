import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface ChatMessage {
  text: string;
  isBot: boolean;
  timestamp: Date;
}

interface AgentResponse {
  success: boolean;
  data: {
    reply: string;
    session: {
      step: string;
      data: any;
    };
  };
}

@Component({
  selector: 'app-chat-agent',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-agent.component.html',
  styleUrls: ['./chat-agent.component.css']
})
export class ChatAgentComponent implements OnInit {
  private http = inject(HttpClient);
  
  isOpen = false;
  messages: ChatMessage[] = [];
  userMessage = '';
  sessionId: string;
  isLoading = false;

  constructor() {
    // Generate or retrieve session ID
    this.sessionId = this.getOrCreateSessionId();
  }

  ngOnInit(): void {
    // Show welcome message when component initializes
    this.addMessage("היי 👋 כאן נציג השירות של \"מגדים\". איך אפשר לעזור?", true);
  }

  private getOrCreateSessionId(): string {
    let sessionId = localStorage.getItem('chatSessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatSessionId', sessionId);
    }
    return sessionId;
  }

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  closeChat(): void {
    this.isOpen = false;
  }

  addMessage(text: string, isBot: boolean): void {
    this.messages.push({
      text,
      isBot,
      timestamp: new Date()
    });
  }

  sendMessage(): void {
    if (!this.userMessage.trim() || this.isLoading) {
      return;
    }

    const message = this.userMessage.trim();
    this.userMessage = '';
    
    // Add user message to chat
    this.addMessage(message, false);
    
    // Set loading state
    this.isLoading = true;

    // Send to backend
    this.http.post<AgentResponse>(`${environment.apiUrl}/agent`, {
      sessionId: this.sessionId,
      message: message
    }).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (response.success && response.data.reply) {
          this.addMessage(response.data.reply, true);
        } else {
          this.addMessage("מצטער, הייתה שגיאה. נסה שוב.", true);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error sending message:', error);
        this.addMessage("מצטער, הייתה שגיאה. נסה שוב מאוחר יותר.", true);
      }
    });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
}

